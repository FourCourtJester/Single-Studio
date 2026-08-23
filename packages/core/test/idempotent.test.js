import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'

import * as Doc from '../src/velcro/doc'
import { apply, mutations } from '../src/velcro/mutations'

// Writing a value that is already there costs a document item, an update frame to
// every peer, an IndexedDB write, and an observer notification that re-renders
// every graphic subscribed to the path. None of that is visible with one operator
// tapping a score; all of it is, the moment a studio polls a feed on a timer.
//
// These count frames rather than inspect state, because the state was always
// right -- it is the traffic that was wrong.

const run = (doc, name, payload) => apply(doc, mutations, name, payload)

/** Update frames the document would send to its peers, and observer wake-ups. */
function watch(doc) {
  const frames = []
  let notified = 0

  doc.on('update', (update) => frames.push(update.byteLength))
  Doc.stateOf(doc).observe(() => {
    notified += 1
  })

  return {
    get frames() {
      return frames.length
    },
    get bytes() {
      return frames.reduce((total, size) => total + size, 0)
    },
    get notified() {
      return notified
    },
  }
}

describe('writing a value that has not changed', () => {
  it('sends nothing at all', () => {
    const doc = Doc.createDoc()

    run(doc, 'set', { 'variables.home.name': 'Broncos' })

    const traffic = watch(doc)

    for (let i = 0; i < 10; i += 1) run(doc, 'set', { 'variables.home.name': 'Broncos' })

    expect(traffic.frames).toBe(0)
    expect(traffic.notified).toBe(0)
    expect(Doc.read(doc, 'variables.home.name')).toBe('Broncos')
  })

  it('compares structurally, so an equal object is not a change', () => {
    const doc = Doc.createDoc()

    run(doc, 'set', { 'variables.feed': { home: 1, away: 2, meta: { period: 'Q1' } } })

    const traffic = watch(doc)

    // A fresh object every poll, as any JSON parse would produce.
    for (let i = 0; i < 5; i += 1) run(doc, 'set', { 'variables.feed': { home: 1, away: 2, meta: { period: 'Q1' } } })

    expect(traffic.frames).toBe(0)
  })

  it('still sends the write that does change something', () => {
    const doc = Doc.createDoc()

    run(doc, 'set', { 'variables.feed': { home: 1, away: 2 } })

    const traffic = watch(doc)

    run(doc, 'set', { 'variables.feed': { home: 1, away: 2 } })
    expect(traffic.frames).toBe(0)

    run(doc, 'set', { 'variables.feed': { home: 1, away: 3 } })
    expect(traffic.frames).toBe(1)
    expect(Doc.read(doc, 'variables.feed')).toEqual({ home: 1, away: 3 })
  })

  it('tells key order apart from key content', () => {
    const doc = Doc.createDoc()

    run(doc, 'set', { 'variables.feed': { home: 1, away: 2 } })

    const traffic = watch(doc)

    // Same content, keys the other way round: not a change anybody can see.
    run(doc, 'set', { 'variables.feed': { away: 2, home: 1 } })
    expect(traffic.frames).toBe(0)

    // An extra key is a change, even though every shared key still matches.
    run(doc, 'set', { 'variables.feed': { home: 1, away: 2, period: 'Q1' } })
    expect(traffic.frames).toBe(1)
  })

  it('does not mistake a missing key for one holding undefined', () => {
    const doc = Doc.createDoc()

    run(doc, 'set', { 'variables.feed': { home: 1 } })

    const traffic = watch(doc)

    run(doc, 'set', { 'variables.feed': { home: 1, away: undefined } })

    // `{ home: 1 }` and `{ home: 1, away: undefined }` are not the same object, and
    // treating them as equal would strand a key that a later poll expects to exist.
    expect(traffic.frames).toBe(1)
  })

  it('re-polling an unchanged collection is free', () => {
    const doc = Doc.createDoc()
    const feed = { ada: { score: 1 }, grace: { score: 2 }, kath: { score: 3 } }

    run(doc, 'replace', { path: 'variables.board', values: feed })

    const traffic = watch(doc)

    for (let i = 0; i < 10; i += 1) run(doc, 'replace', { path: 'variables.board', values: structuredClone(feed) })

    expect(traffic.frames).toBe(0)
  })

  it('writes only the member that moved', () => {
    const doc = Doc.createDoc()

    run(doc, 'replace', { path: 'variables.board', values: { ada: { score: 1 }, grace: { score: 2 } } })

    const before = Y.encodeStateAsUpdate(doc).byteLength
    const traffic = watch(doc)

    run(doc, 'replace', { path: 'variables.board', values: { ada: { score: 1 }, grace: { score: 9 } } })

    expect(traffic.frames).toBe(1)
    expect(traffic.notified).toBe(1)

    // One member's worth of growth, not the whole board's.
    const grew = Y.encodeStateAsUpdate(doc).byteLength - before
    expect(grew).toBeLessThan(before)
  })

  it('leaves a counter reset alone, because it clears subtotals as well', () => {
    const doc = Doc.createDoc()

    run(doc, 'increment', { 'variables.home.score': 3 })
    expect(Doc.read(doc, 'variables.home.score')).toBe(3)

    const traffic = watch(doc)

    // Same value, but a reset means "3 absolutely" -- it has to park the number in
    // the base and drop the per-writer subtotals, or a concurrent add from another
    // operator would resolve against the structure this was meant to clear.
    run(doc, 'set', { 'variables.home.score': 3 })

    expect(traffic.frames).toBeGreaterThan(0)
    expect(Doc.read(doc, 'variables.home.score')).toBe(3)
  })
})
