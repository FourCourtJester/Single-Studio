// Structural equality, for deciding whether a write is worth making.
//
// Yjs has no notion of "set this to what it already is". `map.set(key, value)`
// with an identical value still appends an item to the document, still produces
// an update frame, still persists, and still fires every observer -- which
// republishes the path to every subscriber, so every graphic holding it
// re-renders for a change that did not happen.
//
// That is invisible with one operator tapping a score. It stops being invisible
// the moment a studio polls a third-party feed: ten identical polls cost ten
// frames on the wire, ten IndexedDB writes, and ten re-renders of whatever is on
// air. Comparing first turns all of that into nothing.
//
// Only the shapes the store can actually hold. Values arrive through a Y.Map, so
// they are JSON: primitives, arrays, and plain objects. Nothing here needs to
// cope with class instances, cycles, or Dates, and pretending otherwise would be
// a slower comparison bought for cases that cannot occur.

export function equal(a, b) {
  // Object.is rather than ===, so a stored NaN compares equal to itself and a
  // rewrite of -0 over 0 is still counted as a change.
  if (Object.is(a, b)) return true

  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false

  if (Array.isArray(a) !== Array.isArray(b)) return false

  const keys = Object.keys(a)

  if (keys.length !== Object.keys(b).length) return false

  return keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
}
