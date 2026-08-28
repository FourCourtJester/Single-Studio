import { IndexeddbPersistence } from 'y-indexeddb'

import { channelFor, statusChannelFor } from './channels'
import { defaultConfig, isPlugin } from '../services/plugin'
import { SettingsStore } from './settings'
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
  const { name = 'studio', mutations: extra = {}, persist = true, onReady, sync: syncConfig, plugins: declared = [] } = config

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

  // -- plugins --------------------------------------------------------------
  //
  // A plugin brings the outside world in: a game, a spreadsheet, a scoring feed. It
  // is constructed here rather than by the studio because everything it needs lives
  // here -- `mutate`, and the answer to "should this machine be the one talking".
  //
  // The host owns the lifecycle so a studio author never wires it. Getting it wrong
  // is quiet: a plugin that nobody rechecks keeps polling after somebody else took
  // the OBS role, and the show ends up with two writers on the same paths and no
  // sign that is what happened.

  /** @type {Map<string, import('../services/plugin').PluginRuntime>} */
  const plugins = new Map()

  /** Definitions by name, kept so a plugin can be rebuilt when its config changes. */
  const definitions = new Map()

  // Config lives beside hotkeys, in the settings database rather than the document.
  // A port is a fact about one computer: replicating it would push one operator's
  // number onto everybody else's machine, where it is wrong.
  const settings = new SettingsStore(name)
  const settingKey = (plugin) => `plugin:${plugin}`

  const configFor = async (definition) => {
    const stored = await settings.get(settingKey(definition.name), null)

    // Merged over the defaults so a field added by a plugin update arrives at its
    // default rather than missing, the same rule the hotkey map follows.
    return { ...defaultConfig(definition.config), ...(stored && typeof stored === 'object' ? stored : {}) }
  }

  const pluginContext = { mutate, owner: owns, studio: name }

  /**
   * Why a plugin is not running, for the ones that failed before they could say so
   * themselves.
   *
   * A plugin that got as far as connecting reports its own trouble on the runtime,
   * because it is the one that knows and it can change its mind later. This is for
   * the ones that never got that far -- a `create` that threw, settings that would
   * not load -- where there is no runtime to ask.
   */
  const troubles = new Map()

  async function build(definition) {
    const config = await configFor(definition)
    const runtime = definition.create({ ...pluginContext, config })

    plugins.set(definition.name, runtime)
    troubles.delete(definition.name)

    await runtime.start?.()

    return runtime
  }

  /**
   * Start every plugin at once, and let each fail on its own.
   *
   * Concurrent rather than one after another, which it used to be. A plugin's
   * `start` is a handshake with somebody else's software: OBS does not resolve
   * until it has identified, Twitch not until it has welcomed, and a socket to a
   * machine that is switched off does not resolve or reject until the browser gives
   * up on the connection. Awaited in a row, the slowest of those decides when the
   * others may begin, so an operator whose Twitch is briefly unreachable watches
   * Rocket League fail to start for reasons that have nothing to do with Rocket
   * League.
   *
   * `Promise.all` never sees a rejection, because each start catches its own. That
   * is the point: one broken plugin is not a broken show. The rest still start, the
   * studio still runs, and an operator can type a score by hand -- which is the
   * whole reason a graphic has a fallback.
   *
   * Order is unaffected. Both maps are filled synchronously before anything is
   * awaited, so a board lists plugins as the studio declared them however the
   * connections happen to land.
   */
  async function startPlugins() {
    const starting = []

    for (const definition of declared) {
      if (!isPlugin(definition)) {
        console.error('[velcro] plugins must come from definePlugin(); ignoring', definition)
        continue
      }

      if (definitions.has(definition.name)) {
        console.error(`[velcro] two plugins are called "${definition.name}"; ignoring the second`)
        continue
      }

      definitions.set(definition.name, definition)

      starting.push(
        build(definition).catch((error) => {
          const why = String(error?.message ?? error)

          // Kept, not only logged. A console message in a SharedWorker is somewhere
          // an operator will never look, and "Not connecting" with no reason is a
          // support conversation rather than a fix.
          troubles.set(definition.name, why)
          console.error(`[velcro] plugin "${definition.name}" threw while starting`, error)
        }),
      )
    }

    await Promise.all(starting)
  }

  /**
   * What a board needs to render the plugin settings: what is installed, what it
   * can be asked, and what it is currently set to.
   *
   * Answered by the worker because the worker is where plugins are declared. A
   * board that kept its own list would be a second place to edit and a second place
   * to be wrong.
   */
  async function pluginManifest() {
    const list = []

    for (const [pluginName, definition] of definitions) {
      list.push({
        name: pluginName,
        label: definition.label,
        summary: definition.summary,
        help: definition.help,
        config: definition.config,
        values: await configFor(definition),
        status: plugins.get(pluginName)?.status ?? 'idle',
        // The sentence under the status light. Null on a plugin that is fine.
        problem: plugins.get(pluginName)?.problem ?? troubles.get(pluginName) ?? null,
      })
    }

    return list
  }

  /**
   * Store new config and restart that plugin against it.
   *
   * Restarted rather than reconfigured in place: a plugin's config is mostly the
   * address of the thing it talks to, and there is no version of "change the port
   * without reconnecting" that means anything. A stop and a start is also the one
   * path already covered by the ownership tests.
   */
  async function configurePlugin(pluginName, values) {
    const definition = definitions.get(pluginName)

    if (!definition) return { ok: false, reason: `no plugin called "${pluginName}"` }

    const merged = { ...defaultConfig(definition.config), ...values }

    await settings.set(settingKey(pluginName), merged)

    try {
      await plugins.get(pluginName)?.stop?.()
    } catch (error) {
      console.error(`[velcro] plugin "${pluginName}" threw while stopping`, error)
    }

    plugins.delete(pluginName)

    try {
      await build(definition)
    } catch (error) {
      const why = String(error?.message ?? error)

      troubles.set(pluginName, why)
      console.error(`[velcro] plugin "${pluginName}" threw while restarting`, error)

      return { ok: false, reason: why }
    }

    return { ok: true }
  }

  // Every status change, not only delegation: `recheck` is idempotent by design and
  // a plugin that stood down wants to know the moment the room lets it back in.
  sync.watchStatus(() => {
    for (const [pluginName, runtime] of plugins) {
      Promise.resolve(runtime.recheck?.()).catch((error) => console.error(`[velcro] plugin "${pluginName}" failed to recheck`, error))
    }
  })

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

      // Plugins after that, for the same reason and one more: a plugin's first
      // event can arrive immediately, and a mutation it triggers must land on the
      // replayed document rather than be overwritten by the replay.
      //
      // Awaited, because reading each one's stored config is a trip to IndexedDB.
      // Without this `onReady` runs against a plugin map that is still filling.
      return startPlugins().then(() => onReady?.({ doc, registry, mutate, owns, sync, plugins }))
    })
    .catch((err) => {
      // Persistence failing must not take the show down: an in-memory doc still
      // drives graphics correctly, it just will not survive a reload.
      console.error('[velcro] persistence unavailable, continuing in memory', err)
      ready = true
      status.postMessage({ type: READY, name, degraded: true })
    })

  /**
   * Dispatch a mutation from inside the worker.
   *
   * The same call a board makes through `useVelcroMutate`, available to the studio
   * itself. This is what a studio that owns data nobody types needs: poll a scoring
   * API, listen to a socket, run a clock of your own, and land the result through
   * the same registry, in the same transaction, replicated to every peer and every
   * tab exactly like an operator's edit.
   *
   * It belongs in the worker rather than on a board because there is one worker and
   * there may be five boards. A poll started on the page would run once per tab,
   * five writes racing for the same paths; started here it runs once, because the
   * SharedWorker is the one thing a studio has exactly one of.
   */
  function mutate(name, payload) {
    return apply(doc, registry, name, payload, 'local', sync.now)
  }

  /**
   * Whether this machine should be the one talking to the outside world.
   *
   * False once somebody else in the room has claimed the OBS role. Ingress needs a
   * single owner and this is the one already known: five operators each polling the
   * same scoring API is five times the quota and five writers racing on the same
   * paths, and the machine that has to *display* the show is the obvious one to be
   * doing it. Everybody else reads the replicated result, which is the same show a
   * moment later and none of the cost.
   *
   * True on a studio that never joined a room, so a one-machine show is always its
   * own owner and nothing here can lock anybody out of their own board.
   *
   * A predicate rather than a value because the answer changes: a studio starts up
   * alone, joins a room a moment later, and the machine holding the role can leave
   * mid-show. Ask again each time round.
   */
  function owns() {
    return !sync.delegated
  }

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

      case 'plugins:list':
        pluginManifest().then((value) => port.postMessage({ type: 'plugins:list:result', id: message.id, value }))
        break

      case 'plugins:configure':
        configurePlugin(message.plugin, message.values).then((value) => port.postMessage({ type: 'plugins:configure:result', id: message.id, value }))
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

  return { doc, registry, mutate, owns, connect, started, subscriptions, sync, plugins, pluginManifest, configurePlugin }
}
