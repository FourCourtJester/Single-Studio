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

  /** The attempt in progress, and the means of calling it off. */
  #starting = null

  #abort = null

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

  /**
   * Subclasses implement this. Resolve on connect, reject to trigger backoff.
   *
   * An `open()` that waits for anything before it connects -- a token, a lookup --
   * should check `signal.aborted` once it has, and connect only if not. Stopping
   * mid-way aborts it, and a connection made after that belongs to a service that
   * was told to stand down. Whatever it does make is closed when it resolves, but
   * one that never made it is better than one closed a second later.
   *
   * @param {AbortSignal} [_signal]
   */
  async open(_signal) {
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

    // Already coming up: wait for that rather than opening a second connection.
    // `status` only moves once `open()` settles, so a service still connecting reads
    // as idle, and `recheck` -- wired to every sync status change -- starts idle
    // services. Twitch spends seconds connecting, each page opened at startup was a
    // recheck, and each one left another socket subscribed: every chat message
    // arrived three times.
    if (this.#starting) return this.#starting

    const abort = new AbortController()

    this.#abort = abort
    this.#starting = this.#connect(abort.signal).finally(() => {
      if (this.#abort === abort) this.#starting = null
    })

    return this.#starting
  }

  async #connect(signal) {
    try {
      await this.open(signal)

      if (signal.aborted) {
        // Stopped while connecting. `stop()` closed what was open at the time, which
        // was nothing yet; this is what arrived since. Left alone, a poll keeps its
        // timer and a socket keeps delivering, for a service nobody will close.
        if (this.#stopped) await this.close()

        return this
      }

      this.#attempt = 0
      this.status = 'connected'
      this.problem = null
    } catch (err) {
      if (signal.aborted) return this

      this.status = 'error'
      this.#retry(err)
    }

    return this
  }

  async stop() {
    this.#stopped = true
    this.#abort?.abort()
    this.#abort = null
    this.#starting = null
    clearTimeout(this.#timer)
    this.status = 'idle'
    this.problem = null
    await this.close()
  }

  /**
   * The longest it waits between attempts. Thirty seconds suits an API across the
   * internet, where hammering a struggling service makes it worse; see SocketService
   * for why a program on this computer gets less.
   */
  get retryCapMs() {
    return BACKOFF.max
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

    const delay = Math.min(BACKOFF.initial * BACKOFF.factor ** this.#attempt, this.retryCapMs)

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
