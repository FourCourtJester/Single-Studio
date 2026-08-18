import { IndexeddbPersistence } from 'y-indexeddb'

import { channelFor, statusChannelFor } from './channels'
import * as Counter from './counter'
import * as Doc from './doc'
import { apply, mutations as defaults } from './mutations'
import { normalize } from './paths'
import { createSync } from './sync'

// The host runs inside the SharedWorker. It owns the one Y.Doc for this studio.
//
// Why the worker: on the streamer's machine the control dock and every OBS
// browser source live in the same CEF process, so a SharedWorker gives all of
// them one store instance for free -- and, later, makes the machine a *single*
// peer on the network rather than one peer per tab.
//
// Transport split:
//   client -> host   MessagePort   (per-client, ordered, and the host knows who sent it)
//   host -> clients  BroadcastChannel  (one channel per path, so tabs only wake for their own data)
//
// `sync` attaches a collaboration transport to the same doc. It is inert unless a
// studio configures one, and it needs nothing from the code below: a provider
// applying a remote update produces an ordinary Yjs transaction, which the
// observers already turn into publishes. See sync.js.

const READY = 'ready'

export function createVelcroHost(config = {}) {
  const { name = 'studio', mutations: extra = {}, persist = true, onReady, sync: syncConfig } = config

  const doc = Doc.createDoc()
  const registry = { ...defaults, ...extra }
  const state = Doc.stateOf(doc)
  const bases = Doc.basesOf(doc)
  const deltas = Doc.deltasOf(doc)

  const status = new BroadcastChannel(statusChannelFor(name))
  /** path -> { channel, ports:Set<number> } */
  const subscriptions = new Map()
  /** Paths touched by the current transaction, flushed once it commits. */
  const dirty = new Set()

  const sync = createSync({ doc, name, status, config: syncConfig })

  // Presence rides the status channel, which already exists and already carries
  // `ready`. A board is the only page that cares, and it is one message per change
  // rather than one per path -- there is no reason to give it a channel of its own.
  sync.watch((peers) => status.postMessage({ type: 'presence', name, peers }), { immediate: false })

  let persistence = null
  let ready = false
  let nextPortId = 1

  // -- publishing ----------------------------------------------------------

  function publish(path) {
    const entry = subscriptions.get(path)

    if (!entry) return

    entry.channel.postMessage({ path, value: Doc.read(doc, path) })
  }

  /**
   * Publish everything the transaction touched.
   *
   * Guarded, and that guard is load-bearing rather than defensive habit. This runs
   * inside Yjs's `afterTransaction`, so an exception here escapes into the middle
   * of Yjs's own bookkeeping and can leave a transaction half applied. When the
   * transaction is a remote update, half applied means the deletes land and the
   * inserts do not -- a Y.Map set being a delete plus an insert, the value on that
   * path does not go stale, it goes *missing*, on air, permanently.
   *
   * A channel that will not take a message is a local problem with one subscriber.
   * It must never be allowed to become a corrupt document.
   */
  function flush() {
    for (const path of dirty) {
      try {
        publish(path)
      } catch (error) {
        console.error('[velcro] could not publish', path, error)
      }
    }

    dirty.clear()
  }

  function markDirty(path) {
    // Only bother tracking paths somebody is actually listening to.
    if (subscriptions.has(path)) dirty.add(path)
  }

  state.observe((event) => {
    for (const key of event.changes.keys.keys()) markDirty(key)
  })

  // Counter keys are the path itself; delta keys carry a clientId prefix.
  bases.observe((event) => {
    for (const key of event.changes.keys.keys()) markDirty(key)
  })

  deltas.observe((event) => {
    for (const key of event.changes.keys.keys()) markDirty(Counter.pathOf(key))
  })

  doc.on('afterTransaction', flush)

  // -- subscriptions ------------------------------------------------------

  function subscribe(path, portId, port) {
    const key = normalize(path)

    if (!subscriptions.has(key)) subscriptions.set(key, { channel: new BroadcastChannel(channelFor(name, key)), ports: new Set() })

    const entry = subscriptions.get(key)

    entry.ports.add(portId)

    // The opening value goes back down the requesting port, not over the channel.
    //
    // It is a point-to-point handshake -- exactly one client asked -- and routing
    // it through a fan-out primitive was both wasteful and unreliable: every other
    // tab woke for a value it already had, and delivery depended on the asking
    // client's channel listener being attached at that instant. On a reloading OBS
    // browser source that raced, and a missed opening value has no recovery path:
    // the graphic sits on its fallback until something else happens to change.
    // A port reply is ordered, targeted, and cannot be missed by a client that just
    // sent the request down it.
    port.postMessage({ type: 'value', path: key, value: Doc.read(doc, key) })
  }

  function unsubscribe(path, portId) {
    const key = normalize(path)
    const entry = subscriptions.get(key)

    if (!entry) return

    entry.ports.delete(portId)

    if (entry.ports.size) return

    entry.channel.close()
    subscriptions.delete(key)
  }

  function dropPort(portId) {
    for (const path of [...subscriptions.keys()]) unsubscribe(path, portId)
  }

  // -- lifecycle ----------------------------------------------------------

  const started = Promise.resolve()
    .then(() => {
      if (!persist) return null

      persistence = new IndexeddbPersistence(name, doc)
      return persistence.whenSynced
    })
    .then(() => {
      ready = true
      status.postMessage({ type: READY, name })

      // Only after persistence has replayed. A provider that starts syncing first
      // either pushes a half-empty document at the room or has the replay land on
      // top of remote state; both read as data loss to whoever is watching.
      if (sync.configured && sync.autoConnect) sync.attach()

      return onReady?.({ doc, registry })
    })
    .catch((err) => {
      // Persistence failing must not take the show down: an in-memory doc still
      // drives graphics correctly, it just will not survive a reload.
      console.error('[velcro] persistence unavailable, continuing in memory', err)
      ready = true
      status.postMessage({ type: READY, name, degraded: true })
    })

  function handle(port, portId, message) {
    const { type } = message ?? {}

    switch (type) {
      case 'hello':
        port.postMessage({ type: READY, name, portId, ready })
        break

      case 'subscribe':
        subscribe(message.path, portId, port)
        break

      case 'unsubscribe':
        unsubscribe(message.path, portId)
        break

      case 'mutate':
        apply(doc, registry, message.name, message.payload, message.origin ?? 'local')
        break

      case 'peek':
        port.postMessage({ type: 'peek:result', id: message.id, value: Doc.read(doc, message.path) })
        break

      case 'snapshot':
        port.postMessage({ type: 'snapshot:result', id: message.id, value: Doc.snapshot(doc) })
        break

      case 'sync:status':
        port.postMessage({ type: 'sync', name, ...sync.snapshot })
        port.postMessage({ type: 'presence', name, peers: sync.peers() })
        break

      // What this machine tells the room about itself: who is at the board, and
      // which paths they have open. One machine is one peer, so the dock speaks for
      // the browser sources sharing its worker.
      case 'presence':
        sync.present(message.state)
        break

      case 'bye':
        dropPort(portId)
        break

      default:
        console.warn('[velcro] unknown message', type)
    }
  }

  function connect(port) {
    const portId = nextPortId
    nextPortId += 1

    port.addEventListener('message', ({ data }) => {
      // Queue everything behind persistence so a mutation fired on page load
      // cannot be overwritten by IndexedDB replaying older state on top of it.
      started.then(() => handle(port, portId, data))
    })

    port.start()
    started.then(() => port.postMessage({ type: READY, name, portId, ready: true }))
  }

  // In a SharedWorker this wires itself up; in a test it stays inert and you
  // drive the returned handle directly.
  if (typeof self !== 'undefined' && 'onconnect' in self) {
    self.onconnect = (event) => connect(event.ports[0])
  }

  return { doc, registry, connect, started, subscriptions, sync }
}
