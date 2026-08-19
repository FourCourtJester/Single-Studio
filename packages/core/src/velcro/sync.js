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

import { createCipher, isSealed } from './crypto'

/** No provider attached. The single-operator default, and where a failure lands. */
export const OFFLINE = 'offline'
export const CONNECTING = 'connecting'
export const CONNECTED = 'connected'
export const ERROR = 'error'

/**
 * How often the clock reference republishes what time it thinks it is.
 *
 * Five seconds is chosen against how the measurement is *used*, not how precise it
 * could be: skew is a property of a machine, so it is effectively constant across a
 * show, and a countdown that starts a beat before the first sample lands is out by
 * the skew it would have been out by anyway. Frequent enough that a joiner is
 * corrected before they touch anything, rare enough to be invisible on the wire.
 */
const BEAT = 5000

/**
 * Re-measurements smaller than this are noise and are ignored.
 *
 * Every sample carries one-way network transit, which moves around by tens of
 * milliseconds between beats. Acting on that would nudge every running clock on the
 * board a few times a minute, which can land either side of a second boundary and
 * show up as a digit that flickers. Clocks here are read in whole seconds; anything
 * under a quarter of one is not a correction, it is jitter.
 */
const JITTER = 250

export function createSync({ doc, name, status, config }) {
  const { connect, room = name, url, token, secret, autoConnect = true } = config ?? {}

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

  /**
   * The clock beat, published alongside presence when this machine is the reference.
   *
   * `{ reference: true, at }` -- a standing claim plus the time it was made. Kept
   * apart from `local` because it is machinery rather than an operator: it must not
   * make an unnamed machine appear in the room's list, and its five-second churn
   * must not re-render a roster that has not changed.
   */
  let beacon = {}

  /**
   * How far this machine's clock is behind the reference, in milliseconds.
   *
   * Added to `Date.now()` everywhere a time is written or read, which is the whole
   * mechanism. Zero when nobody is the reference, so a studio that never sets one
   * behaves exactly as it did before any of this existed.
   */
  let offset = 0

  /**
   * Whether another machine in the room has claimed the OBS role.
   *
   * The clock is not the only thing that role decides. It is also the machine that
   * has to *display* the show, which makes it the only one that can usefully hold a
   * dropped image file, and the only one that should be polling anybody's API. When
   * somebody else is holding it, this machine defers -- see `owner` in useSync.
   *
   * Live rather than sticky, unlike the clock offset: a machine that has left the
   * room is not claiming anything, and the alternative would be a board locked out
   * of its own library because a peer that has long since gone once ticked a box.
   */
  let delegated = false

  /** clientId of the reference being followed, and the last `at` seen from each. */
  let following = null
  const seen = new Map()
  let beating = null
  let known = new Set()

  /**
   * Where we actually are, which is not always where the config said.
   *
   * `attach` takes overrides so a board can join a room the build knew nothing
   * about, and everything downstream -- the status indicator, the token API's
   * address, the invite links a board hands out -- has to be told the room it is
   * in rather than the room it was configured for.
   */
  let active = { url, room, token, secret }

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

  // `url` rides along because the token API lives on the same host as the socket,
  // and a board that can show the room should not have to be told twice where it is.
  // The key itself never travels this way. A board already has it -- it arrived in
  // the link -- so broadcasting it again would be surface for nothing. Whether the
  // show *is* encrypted is a different question, and one an operator should be able
  // to see at a glance.
  const snapshot = () => ({
    state,
    room: active.room,
    url: active.url,
    detail,
    offset,
    reference: Boolean(beacon.reference),
    delegated,
    encrypted: Boolean(active.secret),
  })

  // Only ever sent once a studio has opted in. An offline studio posting "offline"
  // would be a message that never existed before.
  const announceStatus = () => status.postMessage({ type: 'sync', name, ...snapshot() })

  function report(next, why = null) {
    if (state === next && detail === why) return

    state = next
    detail = why

    announceStatus()
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

    const list = []

    for (const [id, state] of awareness.getStates()) {
      if (!state) continue

      // The clock beat is dropped here rather than filtered downstream. It is not
      // something an operator did, so a machine that has only ever published a beat
      // is not a person in the room, and a beat arriving every five seconds is not a
      // change to who is here.
      const { at, reference, ...rest } = state

      if (!Object.keys(rest).length) continue

      list.push({ id, self: id === awareness.clientID, ...rest })
    }

    return list
  }

  /**
   * Announce the room, but only when it is different.
   *
   * Awareness fires a change for anything anyone publishes, the clock beat very much
   * included, and every one of those used to walk down the status channel and set
   * React state on every board in the building. Comparing the projection is one
   * string compare against a list that is never longer than the number of people on
   * the show.
   */
  let announced = null

  const announce = () => {
    const list = peers()
    const shape = JSON.stringify(list)

    if (shape === announced) return

    announced = shape

    for (const watcher of watchers) watcher(list)
  }

  /** Everything this machine publishes about itself: the operator, and the beat. */
  const publishLocal = () => awarenessOf()?.setLocalState({ ...local, ...beacon })

  /** Merge into what we tell the room. Survives reconnects; see `local`. */
  function present(patch) {
    local = { ...local, ...patch }

    for (const [key, value] of Object.entries(local)) {
      if (value === undefined) delete local[key]
    }

    publishLocal()

    // Awareness only notifies on a real change, and an offline studio has no
    // awareness at all, so the local view is announced either way.
    announce()
  }

  // -- the clock -----------------------------------------------------------
  //
  // One machine in the room -- the one running OBS -- publishes what time it thinks
  // it is, and everybody else works out how far off they are and adds the difference
  // to their own `Date.now()`. That is the entire scheme.
  //
  // Deliberately not a round-trip handshake. What a handshake buys is removing
  // one-way transit from the estimate, which on any network worth streaming over is
  // tens of milliseconds; what this removes is machine skew, which on consumer
  // hardware is routinely seconds and sometimes minutes. Measuring the large error
  // roughly beats measuring the small one exactly, and every clock on this system is
  // read in whole seconds anyway.
  //
  // A clock reference is *not* a state authority. Nothing here decides what is true
  // -- state stays a CRDT, and the reference machine has no more say in it than
  // anyone else. It only lends the room a shared idea of "now".

  /** Take a new measurement, unless it is smaller than the noise floor. */
  function adopt(next) {
    if (Math.abs(next - offset) < JITTER) return

    offset = next
    announceStatus()
  }

  function beat() {
    if (!beacon.reference) return

    beacon = { reference: true, at: Date.now() }
    publishLocal()
  }

  function stopBeating() {
    if (beating) clearInterval(beating)

    beating = null
  }

  function startBeating() {
    stopBeating()

    if (!beacon.reference || !awarenessOf()) return

    beat()
    beating = setInterval(beat, BEAT)
    // Under Node a bare interval keeps the process alive; in a worker this is a
    // number and the call quietly does nothing.
    beating?.unref?.()
  }

  /**
   * Beat immediately when somebody new turns up.
   *
   * Without this a joiner waits out a full interval before it can trust a sample --
   * see the staleness rule in `readClock` -- and spends that time running on its own
   * uncorrected clock. Setting local state fires another change, but by then the
   * arrival is already recorded, so this cannot feed itself.
   */
  function greetClock() {
    const awareness = awarenessOf()

    if (!awareness) return

    const now = new Set([...awareness.getStates().keys()].filter((id) => id !== awareness.clientID))
    const arrived = [...now].some((id) => !known.has(id))

    known = now

    if (arrived) beat()
  }

  function defer(next) {
    if (next === delegated) return

    delegated = next
    announceStatus()
  }

  function readClock() {
    const awareness = awarenessOf()

    if (!awareness) return

    const states = awareness.getStates()

    // Two machines both told they run OBS is a misconfiguration, not a crash. The
    // lowest client id wins, which every peer works out identically, so nobody ends
    // up following a different clock from everybody else.
    const claims = [...states.entries()]
      .filter(([id, state]) => id !== awareness.clientID && state?.reference)
      .map(([id]) => id)
      .sort((a, b) => a - b)

    // Deferring does not wait for a beat. A machine that has said it runs OBS owns
    // the library and the ingress from that moment; only its *clock* needs a
    // measurable timestamp before anyone can use it.
    defer(!beacon.reference && claims.length > 0)

    // The reference does not correct itself: it is what everyone else corrects
    // against, so its own offset is zero by definition.
    if (beacon.reference) {
      following = null
      adopt(0)
      return
    }

    // Forget a machine that left, so if it comes back its first value is treated as
    // the unknown-age thing it is rather than measured against one from before.
    for (const id of [...seen.keys()]) if (!states.has(id)) seen.delete(id)

    const chosen = claims.filter((id) => Number.isFinite(states.get(id).at)).at(0) ?? null

    following = chosen

    // The last measurement is kept rather than reset. A machine that has gone quiet
    // has not changed what time it is, and snapping every running clock on the board
    // by several seconds would be a visible fault where holding still is invisible.
    if (chosen === null) return

    const at = states.get(chosen).at
    const before = seen.get(chosen)

    seen.set(chosen, at)

    // The first value read from a peer may have been written long ago: awareness
    // state persists, so a machine joining an established room sees whatever the
    // reference last published, not what it is publishing now. Only a value we
    // watched *change* has a known age, so the opening one is recorded and skipped.
    if (before === undefined || at === before) return

    adopt(at - Date.now())
  }

  /** Declare -- or stop declaring -- that this machine sets the room's clock. */
  function clock(on) {
    const want = Boolean(on)

    if (want === Boolean(beacon.reference)) return

    beacon = want ? { reference: true, at: Date.now() } : {}
    seen.clear()
    following = null

    if (want) offset = 0

    publishLocal()

    if (want) startBeating()
    else stopBeating()

    announceStatus()
    readClock()
  }

  const onAwareness = () => {
    greetClock()
    readClock()
    announce()
  }

  function bindAwareness() {
    const awareness = awarenessOf()

    if (!awareness) return

    // Re-apply after a reconnect: a fresh provider starts with an empty slot.
    if (Object.keys(local).length || Object.keys(beacon).length) publishLocal()

    known = new Set()
    seen.clear()

    awareness.on('change', onAwareness)
    startBeating()
    onAwareness()
  }

  /** Destroy whatever is attached. Does not touch generation or state. */
  async function teardown() {
    const going = provider

    stopBeating()
    going?.awareness?.off?.('change', onAwareness)
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

    // A link may carry only an address, so a studio that names its own room keeps
    // it. Neither credential travels to a stranger, but they are scoped to
    // different things and so have different rules.
    //
    // A token authorises this operator to a *host*: the relay issued it, and it
    // means nothing anywhere else, but it stays good across rooms on the relay that
    // minted it.
    const elsewhere = Boolean(override?.url) && override.url !== url

    // A key belongs to a *room*, and rotating the room is the only revocation there
    // is -- nobody can be un-told a key they already have, so shutting somebody out
    // means a room they have no key to. Carrying the old key into the new room would
    // undo the whole of that in one line, which is why this is the wider test.
    const rekeying = elsewhere || (Boolean(override?.room) && override.room !== room)

    active = {
      url: override?.url ?? url,
      room: override?.room ?? room,
      token: override?.token ?? (elsewhere ? undefined : token),
      secret: override?.secret ?? (rekeying ? undefined : secret),
    }

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
      // Built here rather than in the provider so there is one implementation of the
      // crypto and one place it is tested, and so a transport needs to know nothing
      // about keys -- only that it has two functions to put bytes through.
      const cipher = active.secret ? createCipher(active.secret) : null
      const built = await build({ doc, name, ...active, seal: cipher?.seal, open: cipher?.open, isSealed, report: speak })

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

    // Alone again, and a machine on its own is always its own owner. Leaving this
    // set would lock a board out of its own image library the moment it dropped off
    // a room, which is the exact opposite of what local-first is for.
    defer(false)

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
    clock,

    /**
     * What time it is in the room, rather than on this machine.
     *
     * Every mutation that writes an instant goes through this. That is the half of
     * skew correction which is easy to miss: correcting only the *display* leaves a
     * five-minute break started by an operator whose clock runs four seconds fast
     * genuinely running four seconds long on air, and looking right on every screen
     * while it does it. Correcting the write makes the stored instant mean the same
     * thing on every machine, and the display correction then simply agrees with it.
     */
    now: () => Date.now() + offset,

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
    /** Milliseconds to add to this machine's clock to get the room's. */
    get offset() {
      return offset
    },
    /** The peer whose clock this machine is following, if any. */
    get following() {
      return following
    },
    /** Whether somebody else in the room holds the OBS role. */
    get delegated() {
      return delegated
    },
    get snapshot() {
      return snapshot()
    },
    autoConnect,
  }
}
