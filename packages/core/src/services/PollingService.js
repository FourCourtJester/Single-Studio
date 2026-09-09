import { Emitter } from '../toolkits/emitter'
import { Service } from './Service'

// A plugin for something that will not tell you when it changes.
//
// The other half of the shape a plugin can take. A socket is told; a poller has to
// ask, and asking has costs a socket does not: somebody else's rate limit, and the
// risk of saying "here is the data" once a second to a studio that then writes it
// into a replicated document once a second.
//
// So three things are built in rather than left to each author to remember:
//
//   1. **Only the owner asks.** Five operators polling the same feed is five times
//      the quota and five writers racing on the same paths, for one feed's worth of
//      information.
//   2. **An unchanged answer says nothing.** The whole reason a poll can be
//      frequent: a read that finds no change costs one request and nothing else.
//   3. **A floor on the interval**, so a typed 1 cannot spend an hour's quota in a
//      minute and get a key rate limited mid-show.
//   4. **A deadline on each read.** `fetch` has no timeout of its own: a request
//      that connects and then stalls neither resolves nor rejects, so a first poll
//      that hits one never settles and the plugin sits there with no retry and
//      nothing to say. This is the polling half of the failure written up in
//      docs/internal/host-hang.md, and it is bounded here for the same reason.
//
// A subclass writes `read`, and a `key` if the default comparison is wrong for it.

export class PollingService extends Service {
  events = new Emitter()

  #timer = null

  #last = null

  constructor(context = {}) {
    super({ mutate: context.mutate, owner: context.owner })

    this.config = context.config ?? {}
    this.studio = context.studio
  }

  /** The fastest this is allowed to ask, whatever the config says. Seconds. */
  get floorSeconds() {
    return 5
  }

  /**
   * How long one read may take before it counts as failed, or 0 to wait forever.
   *
   * Ten seconds because this is one request for a small answer, not a download. A
   * feed that cannot manage that is not busy, and being wrong costs a retry on the
   * next tick -- which is what a request that had the manners to fail would have
   * cost anyway.
   *
   * Raise it on a subclass whose `read` does more than one round trip.
   *
   * @returns {number} Milliseconds.
   */
  get readBudgetMs() {
    return 10_000
  }

  /** What the config says, or 30, but never below the floor. */
  get everySeconds() {
    return Math.max(this.floorSeconds, Number(this.config.every) || 30)
  }

  /**
   * Ask once. Return whatever came back, or throw.
   *
   * Throwing is how a subclass says "this is broken" -- see `fatal` for the
   * difference between broken and merely unavailable.
   *
   * The signal is the read's deadline, and passing it to `fetch` is what makes the
   * request actually stop rather than merely stop being waited on. A subclass that
   * ignores it is still protected -- the deadline is enforced here either way -- it
   * just leaves the request running until the far end gives up.
   *
   * @param {AbortSignal} [_signal]
   * @returns {Promise<unknown>}
   * @abstract
   */
  async read(_signal) {
    throw new Error(`${this.name} must implement \`read\``)
  }

  /**
   * One read, held to its deadline.
   *
   * Raced rather than left to the signal alone, because the signal only helps if
   * the subclass wired it up. This is the part the base class can guarantee.
   */
  async #ask() {
    const budget = this.readBudgetMs

    if (!budget) return this.read()

    const controller = new AbortController()
    let timer = null

    const late = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error(`${this.name} did not answer within ${Math.round(budget / 1000)}s.`))
      }, budget)
    })

    try {
      return await Promise.race([this.read(controller.signal), late])
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Whether an error is worth retrying.
   *
   * The distinction that stops a plugin spending quota to be refused again: a
   * private spreadsheet stays private however many times it is asked, while a
   * dropped network is gone for a moment. Retrying the first is pointless and
   * retrying the second is the whole point.
   *
   * @param {Error} _error
   * @returns {boolean} True to stop rather than back off.
   */

  fatal(_error) {
    return false
  }

  /**
   * What to compare, to decide whether anything happened.
   *
   * A string by default, because what these read is small and made of strings.
   * Override for something big enough that a fingerprint is cheaper.
   */
  key(value) {
    return JSON.stringify(value)
  }

  /**
   * What to emit when something did change. Defaults to `changed`.
   *
   * @param {unknown} value
   */
  publish(value) {
    this.emit('changed', value)
  }

  /**
   * What a `problem` event carries.
   *
   * The message alone is enough for a board to show, but a subclass usually knows
   * something more useful -- a status code, a field to blame -- and the handler
   * that reacts to it should not have to parse the sentence to find out.
   *
   * @param {Error} error
   */
  problemOf(error) {
    return { message: error?.message ?? String(error) }
  }

  async open() {
    // The first read decides whether this is working at all, so a wrong id or a
    // refused key is reported now rather than on a timer nobody is watching.
    await this.poll(true)

    this.#timer = setInterval(() => {
      this.poll().catch(() => {})
    }, this.everySeconds * 1000)
  }

  /**
   * @param {boolean} [first] Throw rather than back off, so `open()` fails loudly.
   */
  async poll(first = false) {
    // Asked afresh every time: a machine that lost the role while the timer was running
    // stands down at the next tick rather than carrying on writing.
    if (!this.owns) return

    let value

    try {
      value = await this.#ask()
    } catch (error) {
      if (first) throw error

      if (this.fatal(error)) {
        this.status = 'error'
        this.stopTimer()
        this.emit('problem', this.problemOf(error))

        return
      }

      this.dropped(error)

      return
    }

    const fingerprint = this.key(value)

    if (this.#last !== null && this.#last === fingerprint) return

    this.#last = fingerprint
    this.status = 'connected'
    this.publish(value)
  }

  stopTimer() {
    clearInterval(this.#timer)
    this.#timer = null
  }

  async close() {
    this.stopTimer()
  }

  emit(...args) {
    return this.events.emit(...args)
  }
}
