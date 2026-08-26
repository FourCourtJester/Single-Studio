import * as Counter from './counter'
import * as Doc from './doc'
import { equal } from './equal'
import { isNullable, isUnder, normalize, SEPARATOR, toEntries, toPaths } from './paths'

// Mutations replace the old Redux reducers. Same ergonomics -- a named function
// that receives a payload and changes state -- but it operates on a Yjs
// transaction instead of an immer draft, so there is no store to configure and
// no middleware chain to thread through.
//
// A studio adds its own by passing `mutations` to createVelcroHost(). They land
// in the same registry as these and are called the same way, which is the whole
// extensibility story: a studio is not special, it is just more mutations.
//
// Signature: (ctx, payload) => void
//   ctx.doc          the Y.Doc
//   ctx.state        flat Y.Map of plain values
//   ctx.clientId     this host's Yjs clientID -- the counter's writer identity
//   ctx.read(path)      current value at a path
//   ctx.write(pairs)    apply [path, value] pairs, pruning empty values
//   ctx.add(path, n)    add to a counter, promoting the path if needed
//   ctx.collect(prefix) every member of a collection, keyed by member
//   ctx.list(prefix)    the same, as a sorted array
//   ctx.now()           what time it is *in the room* -- see below

/** Write a plain value, deleting the key when the value means "nothing". */
function writeOne(ctx, path, value) {
  const key = normalize(path)

  // Already a counter? An absolute write parks the value in its base.
  //
  // Deliberately not skipped when the sum already matches. A counter's value is
  // base plus every writer's subtotal, and a reset means "this is the number now"
  // -- it parks the value in the base and drops the subtotals. Skipping a reset
  // that happens to agree with the current sum would leave those subtotals in
  // place, so the next concurrent add would resolve against a structure the
  // operator believes they cleared.
  if (Counter.exists(ctx.bases, key)) {
    if (isNullable(value)) Counter.remove(ctx.bases, ctx.deltas, key)
    else Counter.reset(ctx.bases, ctx.deltas, key, Number(value))
    return
  }

  if (isNullable(value)) {
    if (ctx.state.has(key)) ctx.state.delete(key)
    return
  }

  // Nothing to say, so say nothing. Setting a key to what it already holds is a
  // real write to Yjs: a document item, an update frame to every peer, an
  // IndexedDB write, and an observer notification that re-renders every graphic
  // subscribed to the path. See equal.js.
  if (ctx.state.has(key) && equal(ctx.state.get(key), value)) return

  ctx.state.set(key, value)
}

/**
 * The array at a path, for the mutations that grow and shrink one.
 *
 * An absent path is an empty list, so the first `push` onto a cold document works
 * without anybody seeding it. Anything else that is not an array is a mistake
 * worth naming: silently replacing a score with `[3]` would look like it worked.
 */
function asArray(ctx, key, verb) {
  const current = ctx.read(key)

  if (current === undefined) return []
  if (Array.isArray(current)) return current

  throw new TypeError(`${verb} expected an array at ${key}, found ${current === null ? 'null' : typeof current}`)
}

/**
 * A collection key that sorts back into the order things were appended.
 *
 * Zero-padded so it keeps sorting that way as a string: unpadded, the day the
 * timestamp gains a digit every new key would sort *before* every old one, which
 * is a list quietly reversing itself years after anybody touched this file.
 *
 * The client id and sequence are only there to break ties, but they are part of
 * the stored key, so every peer sorts the identical strings and lands on the
 * identical order without exchanging anything.
 */
const KEY_WIDTH = 10

/**
 * Deliberately not on the context.
 *
 * A context is built per transaction, so a counter living there restarts at zero
 * for every mutation -- and two appends in the same millisecond on the same
 * machine would then be handed the identical key, the second one overwriting the
 * first with no error and no trace. This counter outlives the transaction, which
 * is the only scope at which it does its job.
 *
 * A worker restart takes it back to zero, and cannot collide: a fresh Y.Doc gets a
 * fresh client id, and that is in the key too.
 */
let sequence = 0

function stampKey(ctx) {
  sequence += 1

  return `${ctx.now().toString(36).padStart(KEY_WIDTH, '0')}-${ctx.clientId.toString(36)}-${sequence.toString(36)}`
}

export const mutations = {
  /** `{ 'variables.home.name': 'Broncos' }` */
  set(ctx, payload) {
    ctx.write(toEntries(payload))
  },

  /** Like set, but leaves a path alone when the incoming value is nullable. */
  merge(ctx, payload) {
    ctx.write(toEntries(payload).filter(([, value]) => !isNullable(value)))
  },

  /** `'toggles.lowerthird'` or `['a', 'b']` */
  unset(ctx, payload) {
    for (const path of toPaths(payload)) writeOne(ctx, path, undefined)
  },

  /** Flip a boolean. Absent counts as false, so this is safe on a cold doc. */
  toggle(ctx, payload) {
    for (const path of toPaths(payload)) writeOne(ctx, path, !ctx.read(path))
  },

  /**
   * Turn on exactly one path in a group and turn the rest off -- radio-button
   * semantics for scene-ish toggles. `{ group: [...], active: 'x' }`
   */
  only(ctx, { group = [], active }) {
    const target = active ? normalize(active) : null

    for (const path of toPaths(group)) writeOne(ctx, path, normalize(path) === target)
  },

  /** `{ 'variables.home.score': 1 }` or a bare path for a step of one. */
  increment(ctx, payload) {
    for (const [path, amount] of toEntries(payload)) ctx.add(path, Number(amount ?? 1))
  },

  decrement(ctx, payload) {
    for (const [path, amount] of toEntries(payload)) ctx.add(path, -Number(amount ?? 1))
  },

  /**
   * Swap two halves of a list, position for position.
   *
   *   ['home.name', 'home.score', 'away.name', 'away.score']
   *     ^-------- one side -----^  ^------ the other ------^
   *
   * The list is cut down the middle and the halves trade: first with first, second
   * with second. Both halves are written in the same order, which is the property
   * that makes it checkable -- one side, then the other side spelled the same way.
   *
   * It used to trade outermost inwards, so the second half had to be written
   * backwards for the pairs to line up. That reads fine with four paths and stops
   * being checkable at six: a mirrored list is one somebody has to trace with a
   * finger, and getting it wrong swaps a name onto a score with nothing to say so.
   *
   * An odd number of paths has no halves, and is a mistake rather than a shape with
   * a sensible reading -- so it says so instead of dropping the middle one.
   */
  swap(ctx, payload) {
    const paths = toPaths(payload)

    if (paths.length % 2) throw new TypeError(`swap needs an even number of paths to cut in half, got ${paths.length}: ${paths.join(', ')}`)

    const half = paths.length / 2

    for (let i = 0; i < half; i += 1) {
      const from = paths.at(i)
      const to = paths.at(i + half)
      const a = ctx.read(from)
      const b = ctx.read(to)

      writeOne(ctx, from, b)
      writeOne(ctx, to, a)
    }
  },

  /**
   * Start a countdown. Always stored as an absolute epoch so no peer has to tick.
   *
   * Accepts a duration in milliseconds (`{ 'timers.break': 90_000 }`) or an
   * absolute target (`{ 'timers.show': { at, input } }`). The second form is what
   * a wall-clock countdown needs, and keeping both here means a component never
   * has to know the stored shape. `input` round-trips the operator's raw entry so
   * the field can repopulate. A non-positive or past target clears the timer.
   */
  timer(ctx, payload) {
    const now = ctx.now()

    for (const [path, value] of toEntries(payload)) {
      const spec = value && typeof value === 'object' ? value : { duration: value }
      const at = spec.at !== undefined ? Number(spec.at) : now + Number(spec.duration)

      if (!Number.isFinite(at) || at <= now) {
        writeOne(ctx, path, undefined)
        continue
      }

      const timer = { ts: at, duration: spec.duration !== undefined ? Number(spec.duration) : at - now }

      if (spec.input) timer.input = String(spec.input)

      ctx.state.set(normalize(path), timer)
    }
  },

  /**
   * A count-up clock: `{ 'timers.match': 'start' | 'pause' | 'reset' }`.
   *
   * Stored as an origin rather than an accumulating count, for the same reason
   * countdowns store a target: no peer has to tick, and every one of them derives
   * the same number from the same timestamp.
   *
   *   { from }     running since that epoch
   *   { elapsed }  paused, holding that many milliseconds
   *
   * Resuming sets `from` to now minus the held elapsed, so the clock picks up
   * exactly where it stopped without ever having counted anything itself.
   */
  stopwatch(ctx, payload) {
    const now = ctx.now()

    for (const [path, action] of toEntries(payload)) {
      const key = normalize(path)
      const current = ctx.read(key)

      switch (action ?? 'start') {
        case 'start': {
          if (current?.from) break

          ctx.state.set(key, { from: now - Number(current?.elapsed ?? 0) })
          break
        }

        case 'pause': {
          if (!current?.from) break

          ctx.state.set(key, { elapsed: now - Number(current.from) })
          break
        }

        case 'reset': {
          writeOne(ctx, key, undefined)
          break
        }

        default:
          throw new Error(`Unknown stopwatch action: ${action}`)
      }
    }
  },

  /**
   * Append to an array held at one path. `{ path, value }` or `{ path, values }`
   *
   * For a list with one author -- a feed a studio polls, a queue one operator
   * runs, a paste from a spreadsheet. It is last-write-wins on the whole array, so
   * two operators appending inside the replication window keep one append and lose
   * the other, exactly as `+1` and `+1` used to make `+1` before counters existed.
   * When several people add to the same list independently, that is a collection
   * and `append` is the mutation you want.
   */
  push(ctx, { path, value, values } = {}) {
    const key = normalize(path)
    const current = asArray(ctx, key, 'push')
    const incoming = values ?? [value]

    writeOne(ctx, key, [...current, ...incoming])
  },

  /**
   * Take entries out of an array held at one path.
   *
   *   { path, at: 2 }                  by index
   *   { path, where: { id: 'a7' } }    every entry whose fields all match
   *   { path, value: 'Ada' }           every entry equal to this
   *
   * `where` rather than a predicate function because a payload crosses into the
   * SharedWorker by structured clone, and a function does not survive that. A
   * plain object of fields to match does, and covers what a predicate was going to
   * be used for anyway.
   */
  pull(ctx, { path, at, where, value } = {}) {
    const key = normalize(path)
    const current = asArray(ctx, key, 'pull')

    if (at !== undefined) {
      const index = Number(at)

      writeOne(
        ctx,
        key,
        current.filter((_, i) => i !== index),
      )
      return
    }

    if (where !== undefined) {
      writeOne(
        ctx,
        key,
        current.filter((entry) => !Object.entries(where).every(([field, wanted]) => equal(entry?.[field], wanted))),
      )
      return
    }

    writeOne(
      ctx,
      key,
      current.filter((entry) => !equal(entry, value)),
    )
  },

  /** Reorder within an array held at one path. `{ path, from: 0, to: 3 }` */
  move(ctx, { path, from, to } = {}) {
    const key = normalize(path)
    const current = asArray(ctx, key, 'move')
    const next = [...current]
    const [entry] = next.splice(Number(from), 1)

    if (entry === undefined && next.length === current.length) return

    next.splice(Number(to), 0, entry)

    writeOne(ctx, key, next)
  },

  /**
   * Merge fields into the object at a path, leaving the rest alone.
   * `{ path: 'variables.feed', value: { home: 3 } }`
   *
   * One level deep, and on purpose. A deep merge has to guess what a nested object
   * means -- replace it, or merge into it, and there is no answer that is right for
   * both a settings blob and a list of players. Velcro's own answer to nesting is
   * the path: `variables.feed.home` is its own key, and keys merge without anybody
   * choosing a strategy.
   */
  patch(ctx, { path, value } = {}) {
    const key = normalize(path)
    const current = ctx.read(key)

    if (current !== undefined && (typeof current !== 'object' || Array.isArray(current) || current === null)) {
      throw new TypeError(`patch expected an object at ${key}, found ${Array.isArray(current) ? 'an array' : typeof current}`)
    }

    writeOne(ctx, key, { ...current, ...value })
  },

  /**
   * Add a member to a collection: one path per member, so concurrent adds merge.
   * `{ path: 'variables.roster', value: {...} }`, or with `key` to name it.
   *
   * This is the shape to reach for when more than one person adds to the same list.
   * A generated key carries a zero-padded timestamp, this host's client id and a
   * counter, which makes it unique across peers and sortable back into the order
   * things were added -- see Doc.list.
   *
   * Passing `key` yourself makes the add idempotent, which is what a studio syncing
   * from a third-party feed wants: the same record arriving twice lands on the same
   * path, and the second one writes nothing because the value has not changed.
   */
  append(ctx, { path, value, key } = {}) {
    const prefix = normalize(path)
    const member = key ? String(key) : stampKey(ctx)

    if (member.includes(SEPARATOR)) throw new TypeError(`A collection key cannot contain "${SEPARATOR}": ${member}`)

    writeOne(ctx, `${prefix}${SEPARATOR}${member}`, value)
  },

  /**
   * Make a collection match the members given, and write nothing else.
   * `{ path: 'variables.standings', values: { ada: {...}, grace: {...} } }`
   *
   * The mutation for data that arrives from somewhere else -- a scoring API, a
   * bracket, a spreadsheet import. Members that changed are written, members that
   * vanished are deleted, and members that are byte-for-byte what is already there
   * cost nothing at all: no update frame, no persistence write, and no re-render of
   * whatever is holding them on air. Polling an unchanged feed every second is then
   * genuinely free, which is what makes polling a reasonable thing to do.
   */
  replace(ctx, { path, values = {} } = {}) {
    const prefix = normalize(path)
    const present = ctx.collect(prefix)

    for (const member of Object.keys(present)) {
      if (!Object.hasOwn(values, member)) writeOne(ctx, `${prefix}${SEPARATOR}${member}`, undefined)
    }

    for (const [member, value] of Object.entries(values)) writeOne(ctx, `${prefix}${SEPARATOR}${member}`, value)
  },

  /**
   * Wipe everything, or everything under a prefix. `{ prefix: 'variables' }`
   *
   * `except` spares one or more prefixes, and exists for the one clear an operator
   * actually presses: start the show over without throwing away the image library.
   * Those are different kinds of thing -- the show is what happened tonight, the
   * library is what somebody spent an afternoon filing -- and a single button that
   * loses both is a button nobody dares touch. Expressed as an exception rather
   * than as a list of prefixes to keep, because a studio's namespaces are its own
   * and core cannot know them.
   */
  clear(ctx, payload = {}) {
    const { prefix, except } = payload
    const spared = toPaths(except ?? [])

    for (const key of Doc.keys(ctx.doc)) {
      if (prefix && !isUnder(key, prefix)) continue
      if (spared.some((one) => isUnder(key, one))) continue

      if (Counter.exists(ctx.bases, key)) Counter.remove(ctx.bases, ctx.deltas, key)
      else ctx.state.delete(key)
    }
  },
}

/** Build the transaction context handed to every mutation. */
export function createContext(doc, now = Date.now, registry = mutations) {
  const bases = Doc.basesOf(doc)
  const deltas = Doc.deltasOf(doc)

  const ctx = {
    doc,
    bases,
    deltas,
    state: Doc.stateOf(doc),
    clientId: doc.clientID,
    /**
     * The room's clock, not this machine's.
     *
     * Identical to `Date.now` on a machine that is alone, or in a room with no clock
     * reference, so a mutation written against this behaves the same either way.
     * Where it differs is the case that matters: an operator whose laptop is four
     * seconds fast starting a five-minute break. Written with `Date.now` the stored
     * target is four seconds late on the machine going to air, and every screen in
     * the show agrees it is correct while the break overruns. Written with this it
     * means five minutes everywhere, because everyone is naming the same instant.
     */
    now,
    read: (path) => Doc.read(doc, path),
    collect: (prefix) => Doc.collect(doc, prefix),
    list: (prefix, options) => Doc.list(doc, prefix, options),
    add: (path, amount) => Counter.add(bases, deltas, Doc.asCounter(doc, path), doc.clientID, amount),
    write: (entries) => {
      for (const [path, value] of entries) writeOne(ctx, path, value)
    },
    /**
     * Run another mutation inside this one, in the same transaction.
     *
     * Reaches the whole registry, so a studio's mutation can build on its own as
     * well as on the built-ins -- `ctx.run('feed:teams', data)` from inside
     * `feed:game`. Still one transaction, so however many it calls, the graphics
     * see one change.
     */
    run: (name, payload) => {
      const mutation = registry[name]

      if (!mutation) throw new Error(`Unknown Velcro mutation: ${name}`)

      return mutation(ctx, payload)
    },
  }

  /**
   * Every built-in, callable straight off the context.
   *
   * `ctx.append({ ... })` rather than importing the built-ins and threading `ctx`
   * through by hand. These are the operations a studio composes with -- a mutation
   * of your own is usually two or three of them under one name -- and making a
   * studio import framework internals to reach them would be a poor trade for the
   * one line it saves here.
   *
   * Bound from `mutations` rather than the registry so a studio that names its own
   * mutation `set` shadows nothing: `ctx.set` is always the built-in, and the
   * studio's own is a `ctx.run('set')` away.
   */
  for (const [name, mutation] of Object.entries(mutations)) {
    ctx[name] = (payload) => mutation(ctx, payload)
  }

  return ctx
}

/**
 * Apply a named mutation inside a single Yjs transaction, so observers see one
 * atomic change and a multi-path write never publishes a half-state.
 */
export function apply(doc, registry, name, payload, origin = 'local', now = Date.now) {
  const mutation = registry[name]

  if (!mutation) throw new Error(`Unknown Velcro mutation: ${name}`)

  let result

  doc.transact(() => {
    result = mutation(createContext(doc, now, registry), payload)
  }, origin)

  return result
}
