import { channelFor, statusChannelFor } from './channels'
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

  /** The host's status channel, opened lazily by the first watcher. */
  #status = null

  #watchers = { sync: new Set(), presence: new Set() }

  #last = { sync: { state: 'offline', room: null, url: null, detail: null }, presence: [] }

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

  /**
   * Watch the collaboration status, or who else is here.
   *
   * Both ride the host's status channel, which already carries `ready`. An
   * operator has to be able to see at a glance whether their edits are landing --
   * on a board driving a live show that is not decoration, it is the difference
   * between fixing a problem and not knowing there is one.
   *
   * The current value is delivered immediately, and asking the host to repeat
   * itself covers the case where the interesting change happened before this page
   * was open.
   */
  #watch(kind, listener) {
    const set = this.#watchers[kind]

    set.add(listener)
    listener(this.#last[kind])

    if (!this.#status) {
      this.ready().then(() => {
        if (this.#status) return

        this.#status = new BroadcastChannel(statusChannelFor(this.#name))
        this.#status.addEventListener('message', ({ data }) => {
          if (data?.type === 'sync') this.#announce('sync', { state: data.state, room: data.room, url: data.url, detail: data.detail })
          if (data?.type === 'presence') this.#announce('presence', data.peers ?? [])
        })

        this.#port.postMessage({ type: 'sync:status' })
      })
    }

    return () => set.delete(listener)
  }

  #announce(kind, value) {
    this.#last[kind] = value

    for (const listener of this.#watchers[kind]) listener(value)
  }

  onSyncStatus(listener) {
    return this.#watch('sync', listener)
  }

  onPresence(listener) {
    return this.#watch('presence', listener)
  }

  /** Tell the room about this machine. Merged, so callers can set one field. */
  present(state) {
    this.ready().then(() => this.#port.postMessage({ type: 'presence', state }))
    return this
  }

  /**
   * Join a room now, rather than at build time.
   *
   * A studio deploys as static files -- GitHub Pages, an object store, a folder --
   * so a relay baked into the build is one that cannot be changed without a
   * rebuild. The SharedWorker cannot read the page's URL to find one, but the page
   * can, which makes this the only place the decision can live.
   */
  connectSync({ url, room, token } = {}) {
    this.ready().then(() => this.#port.postMessage({ type: 'sync:attach', url, room, token }))
    return this
  }

  disconnectSync() {
    this.ready().then(() => this.#port.postMessage({ type: 'sync:detach' }))
    return this
  }

  #receive(data) {
    // The opening value for a subscription comes back down the port rather than
    // over the channel -- see the note in host.js subscribe().
    if (data?.type === 'value') {
      this.#deliver(data.path, data.value)
      return
    }

    // Answers to `sync:status`, which come back down the port because the page
    // asking may have opened after the last change was broadcast.
    if (data?.type === 'sync') {
      this.#announce('sync', { state: data.state, room: data.room, url: data.url, detail: data.detail })
      return
    }

    if (data?.type === 'presence') {
      this.#announce('presence', data.peers ?? [])
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

    // `hydrated` is separate from `value !== undefined`: a path that genuinely
    // holds nothing still counts as loaded once the host has said so. Graphics use
    // this to tell "no value yet" from "no value" -- the first must render nothing,
    // the second may render a fallback.
    entry.hydrated = true
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
      const entry = { channel: null, listeners: new Set(), value: undefined, hydrated: false, closed: false }

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

    // A later subscriber to an already-warm path gets the cached value now rather
    // than waiting for the next change. Keyed on `hydrated`, not on the value being
    // defined, so a path that holds nothing still reports as loaded.
    if (entry.hydrated) listener(entry.value)

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
