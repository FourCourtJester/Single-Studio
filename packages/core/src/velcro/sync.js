// The seam a collaboration transport attaches to.
//
// Core deliberately imports no transport at all. A studio supplies `connect`,
// which builds whatever provider it wants against the host's doc -- y-websocket,
// Hocuspocus, a Durable Object client, a stub in a test. That keeps the framework
// dependency-free and keeps a studio's deployment a static bundle: the relay's URL
// is runtime configuration, never something baked into a build.
//
// Nothing here runs unless a studio asks for it. With no `sync` config the host
// behaves exactly as it did before this existed, which is the property that makes
// the seam safe to add before the relay is written.
//
// Attaching waits for persistence. A provider that starts syncing before
// IndexedDB has replayed would either push a half-empty document at the room or
// have the replay land on top of remote state -- both of which look like data loss
// to whoever is watching.

/** No provider attached. The single-operator default, and where a failure lands. */
export const OFFLINE = 'offline'
export const CONNECTING = 'connecting'
export const CONNECTED = 'connected'
export const ERROR = 'error'

export function createSync({ doc, name, status, config }) {
  const { connect, room = name, url, token, autoConnect = true } = config ?? {}

  /**
   * What this machine tells the room about itself.
   *
   * Kept here rather than on the provider because it has to survive one: an
   * operator who set their name before the relay came up, or who is mid-edit when
   * it drops, must not lose their identity to a reconnect. Every attach re-applies
   * whatever this holds.
   */
  let local = {}
  const watchers = new Set()

  let provider = null
  let state = OFFLINE
  let detail = null
  /**
   * Bumped by every attach *and* every detach, before either does anything that
   * yields.
   *
   * An earlier cut captured it after tearing the old provider down, which left a
   * window: detach while an attach was still awaiting its own teardown, and the
   * attach read the generation the detach had already moved past, decided it was
   * current, and installed a live connection over a deliberate disconnect. The
   * only reliable moment to claim a generation is before the first await.
   */
  let generation = 0

  const snapshot = () => ({ state, room, detail })

  function report(next, why = null) {
    if (state === next && detail === why) return

    state = next
    detail = why

    // Only ever announced once a studio has opted in. An offline studio posting
    // "offline" would be a message that never existed before.
    status.postMessage({ type: 'sync', name, ...snapshot() })
  }

  /** The awareness the current provider exposes, if it has one. */
  const awarenessOf = () => provider?.awareness ?? null

  /**
   * Everyone in the room, this machine included.
   *
   * A machine is one peer, not one tab: the dock and a dozen browser sources share
   * a worker, so they share an identity in the room. Marking which entry is ours
   * lets a board say "you" instead of showing the operator to themselves as a
   * stranger.
   */
  function peers() {
    const awareness = awarenessOf()

    if (!awareness) return Object.keys(local).length ? [{ id: 'local', self: true, ...local }] : []

    return [...awareness.getStates().entries()]
      .filter(([, state]) => state && Object.keys(state).length)
      .map(([id, state]) => ({ id, self: id === awareness.clientID, ...state }))
  }

  const announce = () => {
    const list = peers()

    for (const watcher of watchers) watcher(list)
  }

  /** Merge into what we tell the room. Survives reconnects; see `local`. */
  function present(patch) {
    local = { ...local, ...patch }

    for (const [key, value] of Object.entries(local)) {
      if (value === undefined) delete local[key]
    }

    awarenessOf()?.setLocalState(local)

    // Awareness only notifies on a real change, and an offline studio has no
    // awareness at all, so the local view is announced either way.
    announce()
  }

  function bindAwareness() {
    const awareness = awarenessOf()

    if (!awareness) return

    // Re-apply after a reconnect: a fresh provider starts with an empty slot.
    if (Object.keys(local).length) awareness.setLocalState(local)

    awareness.on('change', announce)
    announce()
  }

  /** Destroy whatever is attached. Does not touch generation or state. */
  async function teardown() {
    const going = provider

    going?.awareness?.off?.('change', announce)
    provider = null

    if (!going) return

    try {
      await going.destroy?.()
    } catch (error) {
      console.error('[velcro] sync provider failed to shut down cleanly', error)
    }
  }

  async function attach(override) {
    const build = override?.connect ?? connect

    if (!build) return null

    generation += 1

    const mine = generation

    await teardown()

    // Superseded while the old provider was shutting down.
    if (mine !== generation) return null

    report(CONNECTING)

    // A provider that knows its own connection state must win over the seam
    // guessing. Tracking whether it ever spoke is the only way to tell "the
    // provider says connecting" from "we said connecting and it stayed quiet" --
    // the two are the same value in the same variable.
    let spoke = false
    const speak = (next, why) => {
      if (mine !== generation) return

      spoke = true
      report(next, why)
    }

    try {
      const built = await build({ doc, name, room: override?.room ?? room, url: override?.url ?? url, token: override?.token ?? token, report: speak })

      // Detached, or attached somewhere else, while we were connecting. Throw the
      // connection away rather than leaving one live that nobody is holding, and
      // stay quiet: whoever superseded us owns the reported state now.
      if (mine !== generation) {
        await built?.destroy?.()
        return null
      }

      provider = built

      bindAwareness()

      // A provider that never reported anything is assumed connected once it has
      // been built, which covers the simple case of a transport with no events.
      if (!spoke) report(CONNECTED)

      return provider
    } catch (error) {
      if (mine !== generation) return null

      provider = null
      // A relay that will not connect must never take the show down: the host
      // keeps rendering from its own doc, which is the whole point of local-first.
      console.error('[velcro] sync unavailable, continuing local-only', error)
      report(ERROR, error?.message ?? String(error))

      return null
    }
  }

  async function detach() {
    generation += 1

    await teardown()

    // Unconditional: detaching means "be offline", whether or not anything was
    // attached. `report` swallows the no-op, so an unconfigured host stays silent.
    report(OFFLINE)
    announce()
  }

  return {
    attach,
    detach,
    present,
    peers,

    /**
     * Returns an unsubscribe. Called with the full peer list on every change.
     *
     * `immediate: false` for the host, which broadcasts changes rather than state:
     * an offline studio announcing an empty room on startup would be traffic that
     * never existed before, and "identical when off" is the property that makes
     * this whole seam safe to have landed early. A page that opens later asks for
     * the current list over its port instead.
     */
    watch(fn, { immediate = true } = {}) {
      watchers.add(fn)

      if (immediate) fn(peers())

      return () => watchers.delete(fn)
    },

    /** Whether a studio configured sync at all, regardless of connection state. */
    get configured() {
      return Boolean(connect)
    },
    get state() {
      return state
    },
    get snapshot() {
      return snapshot()
    },
    autoConnect,
  }
}
