// Putting a collection in order.
//
// A collection is one path per member, which is what lets two operators add to the
// same list without one of them losing their entry. What that shape does not carry
// is an order -- a Y.Map has no sequence, and asking one for its keys gives you
// whatever order it happens to hold them in.
//
// So order is decided on the way out, from something every peer can see. Either
// the member keys themselves, which `append` stamps with a zero-padded timestamp
// so that sorting them as strings is sorting them by when they were added, or a
// field of the members, for a list whose order belongs to the data: a rank, a
// start time, a surname.
//
// The same function runs in the worker and on the page, so a graphic and a
// mutation reading the same collection never disagree about what "first" means.

/**
 * A collection as `[key, value]` entries, in order.
 *
 * Entries, not bare values, because a member's key is how you address it again --
 * to change it or take it off the list -- and folding that key into the member
 * would collide with whatever fields the studio put there. It is the shape
 * `Object.entries` returns, so `.map(([, item]) => item)` drops the keys for a
 * render that has no use for them.
 */
export function ordered(members, { by, desc = false } = {}) {
  const entries = Object.entries(members ?? {})

  entries.sort(([leftKey, left], [rightKey, right]) => {
    const a = by ? left?.[by] : leftKey
    const b = by ? right?.[by] : rightKey

    // Members with nothing to sort on go last whichever way the list is pointed,
    // rather than clumping at whichever end `undefined` happens to compare toward.
    // A roster where the one player without a seed number leads the table is a
    // graphic somebody has to explain on air.
    if (a === undefined || a === null) return b === undefined || b === null ? 0 : 1
    if (b === undefined || b === null) return -1

    // Numbers numerically, so 10 follows 9 instead of preceding it. Everything else
    // by locale, so names sort the way the audience expects rather than by code
    // point -- which is the difference between Ángela beside Anna and Ángela last.
    if (typeof a === 'number' && typeof b === 'number') return a - b

    return String(a).localeCompare(String(b))
  })

  return desc ? entries.reverse() : entries
}
