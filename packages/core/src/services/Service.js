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

const BACKOFF = { initial: 500, max: 30_000, factor: 2 }

export class Service {
  static serviceName = 'service'

  #attempt = 0

  #timer = null

  #stopped = false

  /**
   * @param {object} options
   * @param {(name: string, payload: unknown) => void} options.mutate dispatch into Velcro
   * @param {boolean} [options.owner] false on machines that only consume this service's output
   */
  constructor({ mutate, owner = true, ...config } = {}) {
    if (typeof mutate !== 'function') throw new TypeError('Service requires a `mutate` function')

    this.mutate = mutate
    this.owner = owner
    this.config = config
    this.status = 'idle'
  }

  get name() {
    return this.constructor.serviceName
  }

  /** Subclasses implement this. Resolve on connect, reject to trigger backoff. */
  async open() {
    throw new Error('Service.open() must be implemented')
  }

  /** Subclasses override to tear down sockets, intervals, listeners. */
  async close() {}

  async start() {
    if (!this.owner) {
      this.status = 'delegated'
      return this
    }

    this.#stopped = false

    try {
      await this.open()
      this.#attempt = 0
      this.status = 'connected'
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

    const delay = Math.min(BACKOFF.initial * BACKOFF.factor ** this.#attempt, BACKOFF.max)

    this.#attempt += 1
    console.warn(`[${this.name}] retrying in ${delay}ms`, err?.message ?? err)

    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => this.start(), delay)
  }
}
