import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'

import * as Doc from '../src/velcro/doc'
import { apply, mutations } from '../src/velcro/mutations'

// The two shapes a list can take, and the reason a studio has to choose.
//
// An array at one path is ordered and simple and last-write-wins. A collection is
// one path per member, so concurrent adds merge. These tests pin both, including
// the failure the first one has -- because a studio picking the simple shape needs
// that failure to be a documented property rather than a surprise on air.

const sync = (a, b) => {
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)))
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)))
}

const run = (doc, name, payload) => apply(doc, mutations, name, payload)

describe('arrays at one path', () => {
  it('pushes onto a path that does not exist yet', () => {
    const doc = Doc.createDoc()

    run(doc, 'push', { path: 'variables.queue', value: 'first' })

    expect(Doc.read(doc, 'variables.queue')).toEqual(['first'])
  })

  it('pushes several at once, keeping their order', () => {
    const doc = Doc.createDoc()

    run(doc, 'push', { path: 'variables.queue', values: ['a', 'b'] })
    run(doc, 'push', { path: 'variables.queue', value: 'c' })

    expect(Doc.read(doc, 'variables.queue')).toEqual(['a', 'b', 'c'])
  })

  it('pulls by index, by value, and by matching fields', () => {
    const doc = Doc.createDoc()

    run(doc, 'set', { 'variables.queue': ['a', 'b', 'c'] })
    run(doc, 'pull', { path: 'variables.queue', at: 1 })
    expect(Doc.read(doc, 'variables.queue')).toEqual(['a', 'c'])

    run(doc, 'set', { 'variables.queue': ['a', 'b', 'a'] })
    run(doc, 'pull', { path: 'variables.queue', value: 'a' })
    expect(Doc.read(doc, 'variables.queue')).toEqual(['b'])

    run(doc, 'set', {
      'variables.roster': [
        { id: 1, team: 'home' },
        { id: 2, team: 'away' },
        { id: 3, team: 'home' },
      ],
    })
    run(doc, 'pull', { path: 'variables.roster', where: { team: 'home' } })
    expect(Doc.read(doc, 'variables.roster')).toEqual([{ id: 2, team: 'away' }])
  })

  it('moves an entry from one position to another', () => {
    const doc = Doc.createDoc()

    run(doc, 'set', { 'variables.queue': ['a', 'b', 'c', 'd'] })
    run(doc, 'move', { path: 'variables.queue', from: 0, to: 2 })

    expect(Doc.read(doc, 'variables.queue')).toEqual(['b', 'c', 'a', 'd'])
  })

  it('refuses to treat a non-array as one, rather than replacing it', () => {
    const doc = Doc.createDoc()

    run(doc, 'set', { 'variables.home.name': 'Broncos' })

    expect(() => run(doc, 'push', { path: 'variables.home.name', value: 'x' })).toThrow(/expected an array/)
    expect(Doc.read(doc, 'variables.home.name')).toBe('Broncos')
  })

  it('loses one of two concurrent appends -- the reason collections exist', () => {
    const a = Doc.createDoc()
    const b = Doc.createDoc()

    run(a, 'push', { path: 'variables.queue', value: 'Ada' })
    sync(a, b)

    run(a, 'push', { path: 'variables.queue', value: 'Grace' })
    run(b, 'push', { path: 'variables.queue', value: 'Katherine' })
    sync(a, b)

    expect(Doc.read(a, 'variables.queue')).toHaveLength(2)
    expect(Doc.read(a, 'variables.queue')).toEqual(Doc.read(b, 'variables.queue'))
  })
})

describe('collections', () => {
  it('keeps both of two concurrent appends', () => {
    const a = Doc.createDoc()
    const b = Doc.createDoc()

    run(a, 'append', { path: 'variables.roster', value: { name: 'Ada' } })
    sync(a, b)

    run(a, 'append', { path: 'variables.roster', value: { name: 'Grace' } })
    run(b, 'append', { path: 'variables.roster', value: { name: 'Katherine' } })
    sync(a, b)

    const names = Doc.list(a, 'variables.roster').map(([, member]) => member.name)

    expect(names).toHaveLength(3)
    expect([...names].sort()).toEqual(['Ada', 'Grace', 'Katherine'])
  })

  it('orders both peers identically without them agreeing on anything', () => {
    const a = Doc.createDoc()
    const b = Doc.createDoc()

    run(a, 'append', { path: 'variables.roster', value: { name: 'Grace' } })
    run(b, 'append', { path: 'variables.roster', value: { name: 'Katherine' } })
    sync(a, b)

    expect(Doc.list(a, 'variables.roster')).toEqual(Doc.list(b, 'variables.roster'))
  })

  it('gives distinct keys to several appends in one transaction', () => {
    const doc = Doc.createDoc()

    // A studio's own mutation, appending three members under one frozen clock --
    // which is what every mutation sees, since `now` is fixed for the transaction.
    const registry = {
      ...mutations,
      'roster:seed'(ctx) {
        for (const name of ['Ada', 'Grace', 'Katherine']) mutations.append(ctx, { path: 'variables.roster', value: { name } })
      },
    }

    apply(doc, registry, 'roster:seed', undefined, 'local', () => 1_700_000_000_000)

    expect(Object.keys(Doc.collect(doc, 'variables.roster'))).toHaveLength(3)
  })

  it('sorts by insertion, and by a field when asked', () => {
    const doc = Doc.createDoc()

    run(doc, 'append', { path: 'variables.roster', key: 'c', value: { name: 'Ada', rank: 3 } })
    run(doc, 'append', { path: 'variables.roster', key: 'a', value: { name: 'Grace', rank: 1 } })
    run(doc, 'append', { path: 'variables.roster', key: 'b', value: { name: 'Katherine', rank: 2 } })

    expect(Doc.list(doc, 'variables.roster').map(([key]) => key)).toEqual(['a', 'b', 'c'])
    expect(Doc.list(doc, 'variables.roster', { by: 'rank' }).map(([, m]) => m.name)).toEqual(['Grace', 'Katherine', 'Ada'])
    expect(Doc.list(doc, 'variables.roster', { by: 'rank', desc: true }).map(([, m]) => m.name)).toEqual(['Ada', 'Katherine', 'Grace'])
  })

  it('puts members missing the sort field last, whichever way the list points', () => {
    const doc = Doc.createDoc()

    run(doc, 'append', { path: 'variables.roster', key: 'a', value: { name: 'Ada' } })
    run(doc, 'append', { path: 'variables.roster', key: 'b', value: { name: 'Grace', rank: 2 } })

    expect(Doc.list(doc, 'variables.roster', { by: 'rank' }).map(([, m]) => m.name)).toEqual(['Grace', 'Ada'])
    expect(Doc.list(doc, 'variables.roster', { by: 'rank', desc: true }).map(([, m]) => m.name)).toEqual(['Ada', 'Grace'])
  })

  it('refuses a key that would be read back as two path segments', () => {
    const doc = Doc.createDoc()

    expect(() => run(doc, 'append', { path: 'variables.roster', key: 'a.b', value: 1 })).toThrow(/cannot contain/)
  })
})

describe('replace', () => {
  it('adds, updates and deletes to match what it was given', () => {
    const doc = Doc.createDoc()

    run(doc, 'replace', { path: 'variables.board', values: { ada: { score: 1 }, grace: { score: 2 } } })
    run(doc, 'replace', { path: 'variables.board', values: { grace: { score: 5 }, kath: { score: 3 } } })

    expect(Doc.collect(doc, 'variables.board')).toEqual({ grace: { score: 5 }, kath: { score: 3 } })
  })

  it('leaves nothing behind when given nothing', () => {
    const doc = Doc.createDoc()

    run(doc, 'replace', { path: 'variables.board', values: { ada: { score: 1 } } })
    run(doc, 'replace', { path: 'variables.board', values: {} })

    expect(Doc.collect(doc, 'variables.board')).toEqual({})
  })

  it('does not touch a neighbouring collection with a similar name', () => {
    const doc = Doc.createDoc()

    run(doc, 'replace', { path: 'variables.board', values: { ada: 1 } })
    run(doc, 'replace', { path: 'variables.boardroom', values: { grace: 2 } })
    run(doc, 'replace', { path: 'variables.board', values: {} })

    expect(Doc.collect(doc, 'variables.boardroom')).toEqual({ grace: 2 })
  })
})

describe('patch', () => {
  it('merges fields without disturbing the rest', () => {
    const doc = Doc.createDoc()

    run(doc, 'set', { 'variables.feed': { home: 1, away: 2, period: 'Q1' } })
    run(doc, 'patch', { path: 'variables.feed', value: { home: 3 } })

    expect(Doc.read(doc, 'variables.feed')).toEqual({ home: 3, away: 2, period: 'Q1' })
  })

  it('creates the object when there is nothing there yet', () => {
    const doc = Doc.createDoc()

    run(doc, 'patch', { path: 'variables.feed', value: { home: 1 } })

    expect(Doc.read(doc, 'variables.feed')).toEqual({ home: 1 })
  })

  it('refuses to merge into something that is not an object', () => {
    const doc = Doc.createDoc()

    run(doc, 'set', { 'variables.queue': ['a'] })

    expect(() => run(doc, 'patch', { path: 'variables.queue', value: { a: 1 } })).toThrow(/expected an object/)
  })
})
