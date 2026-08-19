import * as Y from 'yjs'

import * as Counter from './counter'
import { normalize, SEPARATOR } from './paths'

// The document is three flat top-level maps:
//
//   state   path -> JSON value              last-write-wins, the common case
//   bases   path -> number                  a counter's absolute part
//   deltas  '<clientId>:<path>' -> number   each writer's subtotal
//
// A path lives in `state` or in the counter pair, never both. Counters win on
// read, and a path is promoted the first time something increments it.

export const STATE = 'state'
export const BASES = 'counters'
export const DELTAS = 'deltas'

export function createDoc() {
  const doc = new Y.Doc()

  doc.getMap(STATE)
  doc.getMap(BASES)
  doc.getMap(DELTAS)

  return doc
}

export const stateOf = (doc) => doc.getMap(STATE)
export const basesOf = (doc) => doc.getMap(BASES)
export const deltasOf = (doc) => doc.getMap(DELTAS)

export const isCounter = (doc, path) => Counter.exists(basesOf(doc), normalize(path))

/** Single read path. Counters resolve to their sum, everything else is a plain value. */
export function read(doc, path) {
  const key = normalize(path)
  const bases = basesOf(doc)

  if (Counter.exists(bases, key)) return Counter.read(bases, deltasOf(doc), key)

  return stateOf(doc).get(key)
}

/** Every path currently holding a value, counters included. */
export const keys = (doc) => [...new Set([...stateOf(doc).keys(), ...Counter.paths(basesOf(doc))])]

/** Plain-object snapshot, for debugging and the dev harness. */
export const snapshot = (doc) => Object.fromEntries(keys(doc).map((key) => [key, read(doc, key)]))

/**
 * Everything under a prefix, keyed by the part after it.
 *
 * For state that is a *set* rather than a value -- a library of images, a roster --
 * where one path per member is the only conflict-free shape. A single path holding
 * the whole collection would mean two operators adding different members at the
 * same time, and one of them silently losing theirs to last-write-wins. Separate
 * keys in one Y.Map merge; a single object replacing itself does not.
 */
export function collect(doc, prefix) {
  const under = `${normalize(prefix)}${SEPARATOR}`

  return Object.fromEntries(
    keys(doc)
      .filter((key) => key.startsWith(under))
      .map((key) => [key.slice(under.length), read(doc, key)]),
  )
}

/**
 * Promote a path into the counter maps, seeding the base from whatever plain
 * value it already held. Idempotent, and safe to run concurrently on several
 * peers -- they converge on the same base and keep every subtotal.
 */
export function asCounter(doc, path) {
  const key = normalize(path)
  const state = stateOf(doc)

  Counter.ensure(basesOf(doc), key, Number(state.get(key) ?? 0))

  if (state.has(key)) state.delete(key)

  return key
}
