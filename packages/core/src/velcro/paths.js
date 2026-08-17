// Velcro addresses every value by a flat dot-path: `variables.home.score`.
//
// The path is the literal key in a single Y.Map. It is deliberately NOT a tree
// of nested maps -- the whole subscribe/fan-out design is path-keyed, so a flat
// map turns "which subscribers care about this change?" into a Set lookup
// instead of a tree walk.

export const SEPARATOR = '.'

/** Values that mean "no value". A key holding one of these is deleted instead. */
export const NULLABLE = [undefined, null, false, '']

/** Note that 0 is a real value -- a score of zero must survive. */
export const isNullable = (value) => NULLABLE.includes(value)

export function normalize(path) {
  if (typeof path !== 'string') throw new TypeError(`Velcro path must be a string, received ${typeof path}`)

  const trimmed = path
    .split(SEPARATOR)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(SEPARATOR)

  if (!trimmed) throw new TypeError('Velcro path must contain at least one segment')

  return trimmed
}

export const namespaceOf = (path) => normalize(path).split(SEPARATOR).at(0)

export const nameOf = (path) => normalize(path).split(SEPARATOR).slice(1).join(SEPARATOR)

/** True when `path` is `prefix` itself or sits beneath it. */
export function isUnder(path, prefix) {
  const p = normalize(path)
  const q = normalize(prefix)

  return p === q || p.startsWith(`${q}${SEPARATOR}`)
}

/**
 * Accepts `{ 'a.b': 1 }`, `['a.b', 1]`, `[['a.b', 1]]`, or a bare `'a.b'` and
 * returns `[path, value]` entries. A bare path carries an undefined value, which
 * lets `increment('a.b')` fall through to its default step.
 */
export function toEntries(payload) {
  if (typeof payload === 'string') return [[normalize(payload), undefined]]

  if (Array.isArray(payload)) {
    const isPair = payload.length === 2 && typeof payload.at(0) === 'string' && !Array.isArray(payload.at(1))
    return isPair ? [[normalize(payload[0]), payload[1]]] : payload.map(([path, value]) => [normalize(path), value])
  }

  if (payload && typeof payload === 'object') return Object.entries(payload).map(([path, value]) => [normalize(path), value])

  throw new TypeError('Velcro payload must be an object, an entry pair, or an array of entry pairs')
}

/** Accepts a single path or a list of them. */
export const toPaths = (payload) => (Array.isArray(payload) ? payload : [payload]).map(normalize)
