import { channelFor } from './channels'
import { normalize } from './paths'

// Main-thread handle on the host. One per page.
//
// Several components usually want the same path -- three graphics reading
// `variables.home.score` -- so the client refcounts locally and opens exactly
// one BroadcastChannel and one host subscription per path, no matter how many
// hooks are mounted.

let nextRequestId = 1

export class VelcroClient {
  #name

  #worker

  #port

  #ready

  /** path -> { channel, listeners:Set<fn>, value } */
  #subs = new Map()

  #pending = new Map()

  constructor({ name, worker }) {
    if (typeof worker !== 'function') throw new TypeError('Velcro needs a `worker` factory: () => new SharedWorker(...)')

    this.#worker = worker()
    this.#port = this.#worker.port

    // The host is authoritative for the store id, and the client adopts whatever
    // it reports. That is deliberate: channel names are derived from this id, so
    // a studio whose display name drifted from its worker's id used to fail in
    // the worst possible way -- `ready` resolved over the MessagePort, mutations
    // applied in the worker, and every subscription sat silent on a channel name
    // nobody published to. Learning the id from the host makes that unrepresentable.
    this.#ready = new Promise((resolve) => {
      const onMessage = ({ data }) => {
        if (data?.type !== 'ready') return

        this.#port.removeEventListener('message', onMessage)

        if (name && data.name !== name) {
          console.warn(
            `[velcro] studio id "${name}" does not match the worker's "${data.name}"; using the worker's. Share one constant between defineStudio() and createVelcroHost().`,
          )
        }

        this.#name = data.name
        resolve(data)
      }

      this.#port.addEventListener('message', onMessage)
    })

    this.#port.addEventListener('message', ({ data }) => this.#receive(data))
    this.#port.start()
    this.#port.postMessage({ type: 'hello' })

    // Best-effort cleanup so the host is not left holding subscriptions for a
    // tab that is gone. Leaks are survivable (an unread channel post is cheap)
    // but OBS reloads browser sources often enough to be worth handling.
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('pagehide', () => this.#port.postMessage({ type: 'bye' }), { once: true })
    }
  }

  get name() {
    return this.#name
  }

  #receive(data) {
    // The opening value for a subscription comes back down the port rather than
    // over the channel -- see the note in host.js subscribe().
    if (data?.type === 'value') {
      this.#deliver(data.path, data.value)
      return
    }

    if (!data?.type?.endsWith(':result')) return

    const resolver = this.#pending.get(data.id)

    if (!resolver) return

    this.#pending.delete(data.id)
    resolver(data.value)
  }

  /** Fan a value out to everything listening on a path, from either transport. */
  #deliver(path, value) {
    const entry = this.#subs.get(path)

    if (!entry || entry.closed) return

    entry.value = value

    for (const fn of entry.listeners) fn(value)
  }

  #request(type, extra = {}) {
    const id = nextRequestId
    nextRequestId += 1

    return this.ready().then(
      () =>
        new Promise((resolve) => {
          this.#pending.set(id, resolve)
          this.#port.postMessage({ type, id, ...extra })
        }),
    )
  }

  ready() {
    return this.#ready
  }

  /** Fire a named mutation. Queued until the host has finished loading state. */
  mutate(name, payload) {
    this.ready().then(() => this.#port.postMessage({ type: 'mutate', name, payload }))
    return this
  }

  /** One-shot read. Prefer subscribe() for anything rendered. */
  peek(path) {
    return this.#request('peek', { path: normalize(path) })
  }

  /** Whole-document read, for debugging and the dev harness. */
  snapshot() {
    return this.#request('snapshot')
  }

  /**
   * Returns an unsubscribe function. Last listener out closes the channel.
   *
   * The channel cannot open until the host has reported its id, so the wiring
   * happens after ready() while listeners register synchronously.
   */
  subscribe(path, listener) {
    const key = normalize(path)

    if (!this.#subs.has(key)) {
      const entry = { channel: null, listeners: new Set(), value: undefined, closed: false }

      this.#subs.set(key, entry)

      this.ready().then(() => {
        if (entry.closed) return

        // Channel first, then ask: subsequent changes fan out over the channel, and
        // it has to be listening before the host can publish one.
        entry.channel = new BroadcastChannel(channelFor(this.#name, key))
        entry.channel.addEventListener('message', ({ data }) => this.#deliver(data.path, data.value))

        this.#port.postMessage({ type: 'subscribe', path: key })
      })
    }

    const entry = this.#subs.get(key)

    entry.listeners.add(listener)

    // A later subscriber to an already-warm path gets the cached value now
    // rather than waiting for the next change.
    if (entry.value !== undefined) listener(entry.value)

    return () => {
      entry.listeners.delete(listener)

      if (entry.listeners.size) return

      entry.closed = true
      entry.channel?.close()
      this.#subs.delete(key)
      this.ready().then(() => this.#port.postMessage({ type: 'unsubscribe', path: key }))
    }
  }
}

export const createVelcroClient = (config) => new VelcroClient(config)
