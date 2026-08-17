// A PN-counter, because last-write-wins gets scores wrong.
//
// Two operators both hit +1 on the home score inside the replication window.
// Under a plain Y.Map the second write clobbers the first and you get +1 on
// air. That is a scoreboard silently lying during a broadcast, which is the
// worst failure this system has.
//
// Each counter is one base value plus one subtotal per writer; reads sum them.
// Concurrent increments from different clients touch different keys, so they
// commute and both survive. Growth is bounded by the number of clients that
// have ever incremented a path, so there is nothing to compact.
//
// Two flat maps hold it:
//
//   bases   'variables.home.score'      -> 3
//   deltas  '1234567:variables.home.score' -> 1     (clientId prefix)
//
// Flat for a reason that cost a test to find. An earlier cut nested one Y.Map
// per counter. When two peers each incremented a path neither had touched
// before, they *both* constructed a new Y.Map at the same key -- last-write-wins
// kept one object and threw the other away, deltas included. Concurrently
// created containers cannot merge; concurrently set keys can.
//
// Delta keys are `<clientId>:<path>`. Yjs client IDs are integers, so splitting
// on the first colon always recovers the path -- a path containing a colon is
// harmless.

const SEPARATOR = ':'

export const deltaKey = (path, clientId) => `${clientId}${SEPARATOR}${path}`

/** Recover the dot-path from a delta key. */
export const pathOf = (key) => key.slice(key.indexOf(SEPARATOR) + 1)

/** True once anything has incremented this path. */
export const exists = (bases, path) => bases.has(path)

/**
 * Sum of base and every client's subtotal.
 *
 * Scans the delta map, which is O(paths x peers) -- tens of entries in
 * practice, and only on paths somebody is subscribed to.
 */
export function read(bases, deltas, path) {
  if (!exists(bases, path)) return undefined

  let total = Number(bases.get(path) ?? 0)

  deltas.forEach((value, key) => {
    if (pathOf(key) === path) total += Number(value ?? 0)
  })

  return total
}

/** Create the counter if absent, seeding the base. Concurrent calls agree. */
export function ensure(bases, path, seed = 0) {
  if (bases.has(path)) return

  const value = Number(seed)

  bases.set(path, Number.isFinite(value) ? value : 0)
}

/** Add to this client's own subtotal. Commutes with every other client's add. */
export function add(bases, deltas, path, clientId, amount = 1) {
  ensure(bases, path)

  const key = deltaKey(path, clientId)

  deltas.set(key, Number(deltas.get(key) ?? 0) + Number(amount))
}

/**
 * Force an absolute value: park it in the base and drop every subtotal.
 *
 * A `set` racing an `increment` from another client resolves as
 * last-write-wins on the base with the concurrent delta preserved on top --
 * "someone reset the score to 3 while I added 1" lands on 4, which is what an
 * operator expects.
 */
export function reset(bases, deltas, path, value = 0) {
  for (const key of [...deltas.keys()]) if (pathOf(key) === path) deltas.delete(key)

  bases.set(path, Number(value))
}

/** Delete a counter outright, base and all subtotals. */
export function remove(bases, deltas, path) {
  for (const key of [...deltas.keys()]) if (pathOf(key) === path) deltas.delete(key)

  bases.delete(path)
}

/** Every path currently held as a counter. */
export const paths = (bases) => [...bases.keys()]
