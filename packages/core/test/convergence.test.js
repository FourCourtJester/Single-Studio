import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'

import * as Doc from '../src/velcro/doc'
import { apply, mutations } from '../src/velcro/mutations'

// The regression this whole design exists to prevent.
//
// Under a plain last-write-wins map, two operators each hitting +1 inside the
// replication window produces +1 on air -- a scoreboard quietly lying during a
// broadcast. These tests pin the correct behaviour.

const sync = (a, b) => {
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)))
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)))
}

const PATH = 'variables.home.score'

describe('concurrent increments', () => {
  it('adds up instead of clobbering', () => {
    const a = Doc.createDoc()
    const b = Doc.createDoc()

    // Both peers start from a shared zero.
    apply(a, mutations, 'set', { [PATH]: 0 })
    sync(a, b)

    // Offline on both sides, at the same moment.
    apply(a, mutations, 'increment', { [PATH]: 1 })
    apply(b, mutations, 'increment', { [PATH]: 1 })

    sync(a, b)

    expect(Doc.read(a, PATH)).toBe(2)
    expect(Doc.read(b, PATH)).toBe(2)
  })

  it('converges on a mix of increments and decrements from three peers', () => {
    const peers = [Doc.createDoc(), Doc.createDoc(), Doc.createDoc()]
    const [a, b, c] = peers

    apply(a, mutations, 'set', { [PATH]: 10 })
    sync(a, b)
    sync(a, c)

    apply(a, mutations, 'increment', { [PATH]: 3 })
    apply(b, mutations, 'decrement', { [PATH]: 4 })
    apply(c, mutations, 'increment', { [PATH]: 1 })

    sync(a, b)
    sync(b, c)
    sync(a, c)
    sync(a, b)

    for (const peer of peers) expect(Doc.read(peer, PATH)).toBe(10)
  })

  it('keeps a concurrent delta on top of an absolute reset', () => {
    const a = Doc.createDoc()
    const b = Doc.createDoc()

    apply(a, mutations, 'increment', { [PATH]: 5 })
    sync(a, b)

    // One operator resets the score while another scores a point.
    apply(a, mutations, 'set', { [PATH]: 0 })
    apply(b, mutations, 'increment', { [PATH]: 1 })

    sync(a, b)

    expect(Doc.read(a, PATH)).toBe(1)
    expect(Doc.read(b, PATH)).toBe(1)
  })

  it('agrees on plain text values via last-write-wins', () => {
    const a = Doc.createDoc()
    const b = Doc.createDoc()

    apply(a, mutations, 'set', { 'variables.home.name': 'Broncos' })
    apply(b, mutations, 'set', { 'variables.home.name': 'Vandals' })

    sync(a, b)

    expect(Doc.read(a, 'variables.home.name')).toBe(Doc.read(b, 'variables.home.name'))
  })
})
