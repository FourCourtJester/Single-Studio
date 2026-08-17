import * as Y from 'yjs'
import { beforeEach, describe, expect, it } from 'vitest'

import * as Counter from '../src/velcro/counter'

describe('PN-counter', () => {
  let doc
  let bases
  let deltas
  const PATH = 'variables.home.score'

  const write = (fn) => doc.transact(fn)
  const read = () => Counter.read(bases, deltas, PATH)

  beforeEach(() => {
    doc = new Y.Doc()
    bases = doc.getMap('counters')
    deltas = doc.getMap('deltas')
  })

  it('reads undefined until something touches the path', () => {
    expect(read()).toBeUndefined()
  })

  it('seeds a base on first use', () => {
    write(() => Counter.ensure(bases, PATH, 7))
    expect(read()).toBe(7)
  })

  it('leaves an existing base alone on a second ensure', () => {
    write(() => {
      Counter.ensure(bases, PATH, 7)
      Counter.ensure(bases, PATH, 99)
    })

    expect(read()).toBe(7)
  })

  it('accumulates one client’s deltas', () => {
    write(() => {
      Counter.add(bases, deltas, PATH, 'client-a', 1)
      Counter.add(bases, deltas, PATH, 'client-a', 2)
    })

    expect(read()).toBe(3)
  })

  it('sums deltas across clients', () => {
    write(() => {
      Counter.add(bases, deltas, PATH, 'client-a', 2)
      Counter.add(bases, deltas, PATH, 'client-b', 3)
    })

    expect(read()).toBe(5)
  })

  it('subtracts on negative deltas', () => {
    write(() => Counter.add(bases, deltas, PATH, 'client-a', -2))
    expect(read()).toBe(-2)
  })

  it('drops every delta when reset to an absolute value', () => {
    write(() => {
      Counter.add(bases, deltas, PATH, 'client-a', 5)
      Counter.add(bases, deltas, PATH, 'client-b', 5)
      Counter.reset(bases, deltas, PATH, 3)
    })

    expect(read()).toBe(3)
    expect([...deltas.keys()]).toEqual([])
  })

  it('removes the counter entirely', () => {
    write(() => {
      Counter.add(bases, deltas, PATH, 'client-a', 5)
      Counter.remove(bases, deltas, PATH)
    })

    expect(read()).toBeUndefined()
    expect(Counter.exists(bases, PATH)).toBe(false)
  })

  it('does not disturb a neighbouring path', () => {
    const other = 'variables.away.score'

    write(() => {
      Counter.add(bases, deltas, PATH, 'client-a', 4)
      Counter.add(bases, deltas, other, 'client-a', 1)
      Counter.remove(bases, deltas, PATH)
    })

    expect(Counter.read(bases, deltas, other)).toBe(1)
  })

  it('recovers the path from a delta key even when the path contains a colon', () => {
    const odd = 'variables.odd:name'

    expect(Counter.pathOf(Counter.deltaKey(odd, 12345))).toBe(odd)
  })

  it('lists the paths it holds', () => {
    write(() => {
      Counter.add(bases, deltas, PATH, 'client-a', 1)
      Counter.add(bases, deltas, 'variables.away.score', 'client-a', 1)
    })

    expect(Counter.paths(bases).sort()).toEqual(['variables.away.score', PATH])
  })
})
