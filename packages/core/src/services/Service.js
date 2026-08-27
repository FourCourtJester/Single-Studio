// Base class for data sources: OBS, Google Sheets, BakkesMod, whatever comes.
//
// None of those ship in the MVP, but the shape is fixed now because all three of
// the old workers independently reimplemented the same thing -- singleton,
// BroadcastChannel to the store, connect(props), a flat 5s reconnect, no status
// reporting. This is that, extracted once, with two things they lacked:
//
//   1. Exponential backoff. A flat retry is fine against localhost and wrong
//      against anything across a network.
//   2. An `owner` flag. Even with no remote commands, *ingress* needs a single
//      owner: five operators each polling the same Google Sheet burns quota five
//      times over and has five writers racing on the same paths. A service
//      declares which machine runs it; everyone else consumes the result from
//      the replicated document.
//
// `owner` may be a live predicate rather than a fixed boolean, which is how it
// stops being one more thing to configure. The room already knows which machine
// runs OBS -- it is the box the streamer ticked in the Collaborate dialog -- and
// that is the same machine for the same reason: the one that has to display the
// show is the one that should be talking to anybody's API.
//
//   const service = new SheetsService({ mutate, owner: () => !velcro.delegated })
//
//   velcro.onSyncStatus(() => service.recheck())
//
// Two lines, explicit, and no election. The host machine is known in advance.

const BACKOFF = { initial: 500, max: 30_000, factor: 2 }

export class Service {
  static serviceName = 'service'

  #attempt = 0

  #timer = null

  #stopped = false

  /**
   * @param {object} options
   * @param {(name: string, payload: unknown) => void} options.mutate dispatch into Velcro
   * @param {boolean | (() => boolean)} [options.owner] false, or a predicate, on machines that only consume this service's output
   */
  constructor({ mutate, owner = true, ...config } = {}) {
    if (typeof mutate !== 'function') throw new TypeError('Service requires a `mutate` function')

    this.mutate = mutate
    this.owner = owner
    this.config = config
    this.status = 'idle'

    /**
     * Why it is not connected, in a sentence an operator can act on.
     *
     * `status` says a service is in trouble; this says what the trouble is. Without
     * it a board shows a red light and the reason is in a console inside a
     * SharedWorker, which is somewhere nobody will ever look -- so "Not connecting"
     * becomes a support conversation instead of "start OBS" or "check the port".
     *
     * @type {string | null}
     */
    this.problem = null
  }

  get name() {
    return this.constructor.serviceName
  }

  /**
   * Whether this machine runs this service right now.
   *
   * Read afresh every time rather than captured at construction: a service is built
   * when the page loads and the room is joined a moment later, so a value read once
   * would be answering a question nobody had asked yet.
   */
  get owns() {
    return typeof this.owner === 'function' ? Boolean(this.owner()) : Boolean(this.owner)
  }

  /**
   * Start or stop to match the current answer. Idempotent, and safe to call on
   * every status change -- which is exactly how a studio should wire it.
   */
  async recheck() {
    if (this.owns) {
      if (this.status === 'delegated' || this.status === 'idle') await this.start()
      return this
    }

    if (this.status !== 'delegated' && this.status !== 'idle') await this.stop()

    this.status = 'delegated'

    return this
  }

  /** Subclasses implement this. Resolve on connect, reject to trigger backoff. */
  async open() {
    throw new Error('Service.open() must be implemented')
  }

  /** Subclasses override to tear down sockets, intervals, listeners. */
  async close() {}

  async start() {
    if (!this.owns) {
      this.status = 'delegated'
      return this
    }

    this.#stopped = false

    try {
      await this.open()
      this.#attempt = 0
      this.status = 'connected'
      this.problem = null
    } catch (err) {
      this.status = 'error'
      this.#retry(err)
    }

    return this
  }

  async stop() {
    this.#stopped = true
    clearTimeout(this.#timer)
    this.status = 'idle'
    this.problem = null
    await this.close()
  }

  /** Subclasses call this when a connection drops on its own. */
  dropped(err) {
    if (this.#stopped) return
    this.status = 'reconnecting'
    this.#retry(err)
  }

  #retry(err) {
    if (this.#stopped) return

    // Recorded before the wait, not after it. The whole point is that somebody
    // reading the board during the backoff can see why.
    this.problem = err?.message ?? (err ? String(err) : null)

    const delay = Math.min(BACKOFF.initial * BACKOFF.factor ** this.#attempt, BACKOFF.max)

    this.#attempt += 1
    console.warn(`[${this.name}] retrying in ${delay}ms`, err?.message ?? err)

    clearTimeout(this.#timer)
    // Straight back through `start`, which re-asks who owns the role. A service
    // that lost it while it was backing off therefore stands down at the retry
    // rather than waking up half an hour later and writing over the machine that
    // took over -- the check at the top of `start` is doing that work, and a second
    // one here would only look like it was.
    this.#timer = setTimeout(() => this.start(), delay)
  }
}
