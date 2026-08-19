import * as Counter from './counter'
import * as Doc from './doc'
import { isNullable, isUnder, normalize, toEntries, toPaths } from './paths'

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
//   ctx.read(path)   current value at a path
//   ctx.write(pairs) apply [path, value] pairs, pruning empty values
//   ctx.add(path, n) add to a counter, promoting the path if needed
//   ctx.now()        what time it is *in the room* -- see below

/** Write a plain value, deleting the key when the value means "nothing". */
function writeOne(ctx, path, value) {
  const key = normalize(path)

  // Already a counter? An absolute write parks the value in its base.
  if (Counter.exists(ctx.bases, key)) {
    if (isNullable(value)) Counter.remove(ctx.bases, ctx.deltas, key)
    else Counter.reset(ctx.bases, ctx.deltas, key, Number(value))
    return
  }

  if (isNullable(value)) {
    if (ctx.state.has(key)) ctx.state.delete(key)
    return
  }

  ctx.state.set(key, value)
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
   * Swap values pairwise: the first half of the list trades with the second,
   * outermost pair first. `['home.name', 'home.score', 'away.score', 'away.name']`
   * swaps name<->name and score<->score.
   */
  swap(ctx, payload) {
    const paths = toPaths(payload)
    const half = Math.floor(paths.length / 2)

    for (let i = 0; i < half; i += 1) {
      const from = paths.at(i)
      const to = paths.at(-i - 1)
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

  /** Wipe everything, or everything under a prefix. `{ prefix: 'variables' }` */
  clear(ctx, payload = {}) {
    const { prefix } = payload

    for (const key of Doc.keys(ctx.doc)) {
      if (prefix && !isUnder(key, prefix)) continue

      if (Counter.exists(ctx.bases, key)) Counter.remove(ctx.bases, ctx.deltas, key)
      else ctx.state.delete(key)
    }
  },
}

/** Build the transaction context handed to every mutation. */
export function createContext(doc, now = Date.now) {
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
    add: (path, amount) => Counter.add(bases, deltas, Doc.asCounter(doc, path), doc.clientID, amount),
    write: (entries) => {
      for (const [path, value] of entries) writeOne(ctx, path, value)
    },
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
    result = mutation(createContext(doc, now), payload)
  }, origin)

  return result
}
