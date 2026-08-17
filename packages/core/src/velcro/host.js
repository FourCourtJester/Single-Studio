import { IndexeddbPersistence } from 'y-indexeddb'

import { channelFor, statusChannelFor } from './channels'
import * as Counter from './counter'
import * as Doc from './doc'
import { apply, mutations as defaults } from './mutations'
import { normalize } from './paths'

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

const READY = 'ready'

export function createVelcroHost(config = {}) {
  const { name = 'studio', mutations: extra = {}, persist = true, onReady } = config

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

  let persistence = null
  let ready = false
  let nextPortId = 1

  // -- publishing ----------------------------------------------------------

  function publish(path) {
    const entry = subscriptions.get(path)

    if (!entry) return

    entry.channel.postMessage({ path, value: Doc.read(doc, path) })
  }

  function flush() {
    for (const path of dirty) publish(path)
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

  return { doc, registry, connect, started, subscriptions }
}
