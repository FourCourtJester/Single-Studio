import { IndexeddbPersistence } from 'y-indexeddb'

import { channelFor, statusChannelFor } from './channels'
import * as Counter from './counter'
import * as Doc from './doc'
import { apply, mutations as defaults } from './mutations'
import { isUnder, normalize } from './paths'
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

  /** portId -> port, so the host can answer a client directly as well as broadcast. */
  const connected = new Map()

  /**
   * A monotonic stamp on everything the host says, so a page can order it.
   *
   * Two roads out means two queues, and two queues have no shared ordering. Without
   * this, a value delivered late on one road can land *after* a newer value that
   * came by the other and quietly put the old one back on screen -- a stale
   * scoreboard produced by the very redundancy meant to prevent one. The number
   * makes the second copy identifiable as old rather than merely identical.
   */
  let tick = 0

  /**
   * The stamp on the newest status of each kind, which is the *version* of that
   * state rather than the moment it was last mentioned.
   *
   * Needed because a page can also *ask* for the status, and an answer is not news:
   * it describes the state as of when the question was handled. Stamping the answer
   * with a fresh number would make an old answer look like the latest word, and a
   * port with a backlog delivers exactly that -- the reply draining out behind
   * messages the channel had already delivered, and overwriting them.
   */
  const version = { sync: 0, presence: 0 }

  const stamped = (message) => {
    tick += 1

    if (message.type in version) version[message.type] = tick

    return { ...message, seq: tick }
  }

  const statusChannel = new BroadcastChannel(statusChannelFor(name))

  /**
   * Say something to every page, down both roads at once.
   *
   * The channel is the fan-out; the ports are the guarantee. A BroadcastChannel post
   * from a worker is fire-and-forget with no acknowledgement and no recovery -- this
   * codebase has already been bitten by one going missing, which is why a
   * subscription's opening value stopped riding it (see subscribe()). Everything
   * else about status had the same shape and the same failure: a board that missed
   * the one message saying who holds the room, or that the show had arrived, sat
   * there looking connected and wrong until somebody reloaded it.
   *
   * A duplicate is harmless -- the client stores the value and tells its listeners,
   * and telling them the same thing twice is a comparison, not a render -- so
   * sending both ways costs a message and removes a class of silent staleness.
   */
  const status = {
    postMessage(message) {
      const stampedMessage = stamped(message)

      try {
        statusChannel.postMessage(stampedMessage)
      } catch (error) {
        console.error('[velcro] could not broadcast status', error)
      }

      for (const port of connected.values()) {
        try {
          port.postMessage(stampedMessage)
        } catch (error) {
          console.error('[velcro] could not tell a page about status', error)
        }
      }
    },
  }

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

  /**
   * A subscription to a whole namespace rather than one value.
   *
   * `assets.*` means "every path under `assets.`, as an object". Collections are
   * how a *set* of things replicates without conflicts -- one path per member, so
   * two operators adding different members merge instead of one losing theirs.
   */
  const COLLECTION = '.*'
  const isCollection = (path) => path.endsWith(COLLECTION)
  const prefixOf = (path) => path.slice(0, -COLLECTION.length)

  function valueAt(path) {
    return isCollection(path) ? Doc.collect(doc, prefixOf(path)) : Doc.read(doc, path)
  }

  function publish(path) {
    const entry = subscriptions.get(path)

    if (!entry) return

    const message = stamped({ type: 'value', path, value: valueAt(path) })

    // Both roads, for the reason in `status` above. The host already knows exactly
    // which ports asked for this path, so the direct answer is not even a fan-out
    // being simulated -- it is the more precise of the two.
    entry.channel.postMessage(message)

    for (const portId of entry.ports) {
      try {
        connected.get(portId)?.postMessage(message)
      } catch (error) {
        console.error('[velcro] could not publish to a page', path, error)
      }
    }
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

    // A change to one member is a change to the collection it belongs to. Cheap
    // because there are only ever a handful of collection subscriptions -- a board
    // watching a library, not a graphic watching a score.
    for (const key of subscriptions.keys()) {
      if (isCollection(key) && isUnder(path, prefixOf(key))) dirty.add(key)
    }
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
    // A collection's trailing `*` is not a path segment, so it is stripped before
    // normalising and put back afterwards.
    const key = isCollection(path) ? `${normalize(prefixOf(path))}${COLLECTION}` : normalize(path)

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
    port.postMessage(stamped({ type: 'value', path: key, value: valueAt(key) }))
  }

  function unsubscribe(path, portId) {
    const key = isCollection(path) ? `${normalize(prefixOf(path))}${COLLECTION}` : normalize(path)
    const entry = subscriptions.get(key)

    if (!entry) return

    entry.ports.delete(portId)

    if (entry.ports.size) return

    entry.channel.close()
    subscriptions.delete(key)
  }

  function dropPort(portId) {
    for (const path of [...subscriptions.keys()]) unsubscribe(path, portId)

    connected.delete(portId)
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

      // `sync.now` rather than `Date.now`: a mutation that writes an instant --
      // a countdown target, a stopwatch origin -- has to write it in the room's
      // frame, or a skewed operator's five-minute break is five minutes on their
      // screen and something else on air. Identical to `Date.now` when nobody is
      // the clock reference, which is the single-machine default.
      case 'mutate':
        apply(doc, registry, message.name, message.payload, message.origin ?? 'local', sync.now)
        break

      case 'peek':
        port.postMessage({ type: 'peek:result', id: message.id, value: Doc.read(doc, message.path) })
        break

      case 'snapshot':
        port.postMessage({ type: 'snapshot:result', id: message.id, value: Doc.snapshot(doc) })
        break

      /**
       * Empty this machine: leave the room, clear the document, delete the store.
       *
       * All three happen here rather than on the page, because the order is the
       * whole correctness of it and only the worker can guarantee it.
       *
       * Detaching first, and *awaited*: the document is a CRDT, so clearing it
       * while a provider is still observing replicates the clearing, and a control
       * that says "reset this machine" would take the show off everybody else's
       * board too. A page can ask for a detach and then ask for a clear, but it
       * cannot know the provider finished coming down in between.
       *
       * Deleting the store last, and from in here: the connection to it lives in
       * this worker, the worker outlives the page's reload, and `deleteDatabase`
       * against an open connection blocks rather than failing -- so a page trying
       * to do this itself would appear to do nothing and then do it at some
       * unrelated later moment.
       */
      case 'wipe':
        sync
          .detach()
          .then(() => {
            apply(doc, registry, 'clear', {}, 'local', sync.now)

            return persistence?.clearData()
          })
          .catch((error) => {
            // Reported rather than thrown: the page still has storage to clear and a
            // reload to do, and a half-done reset is worse than a noisy one.
            console.error('[velcro] wipe did not complete cleanly', error)
          })
          .finally(() => port.postMessage({ type: 'wipe:result', id: message.id, value: true }))
        break

      // Answered with the version of the state, not a fresh one. An answer that
      // has been overtaken while it was in the queue must lose to what overtook it;
      // unstamped, it won instead, and the board it landed on stayed wrong for the
      // rest of the show because nothing asks twice.
      case 'sync:status':
        port.postMessage({ type: 'sync', name, ...sync.snapshot, seq: version.sync })
        port.postMessage({ type: 'presence', name, peers: sync.peers(), seq: version.presence })
        break

      // What this machine tells the room about itself: who is at the board, and
      // which paths they have open. One machine is one peer, so the dock speaks for
      // the browser sources sharing its worker.
      case 'presence':
        sync.present(message.state)
        break

      // Joining a room at runtime rather than at build time.
      //
      // A studio deploys as static files, so anything baked into the build is
      // something the operator would have to rebuild and redeploy to change. The
      // worker cannot read the page's URL to find a relay, but a page can, and it
      // can hand it down this port.
      case 'sync:attach':
        sync.attach({ url: message.url, room: message.room, token: message.token })
        break

      case 'sync:detach':
        sync.detach()
        break

      // Whether this machine is the one everybody else sets their watch by. It is a
      // property of the machine rather than of the room, so it arrives separately
      // from the relay's address and is never carried on an invite link.
      case 'sync:clock':
        sync.clock(message.reference)
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

    connected.set(portId, port)

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
