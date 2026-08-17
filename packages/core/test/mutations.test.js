import { beforeEach, describe, expect, it } from 'vitest'

import * as Doc from '../src/velcro/doc'
import { apply, mutations } from '../src/velcro/mutations'

const run = (doc, name, payload) => apply(doc, mutations, name, payload)

describe('mutations', () => {
  let doc

  beforeEach(() => {
    doc = Doc.createDoc()
  })

  describe('set', () => {
    it('writes values addressed by path', () => {
      run(doc, 'set', { 'variables.home.name': 'Broncos', 'variables.away.name': 'Vandals' })

      expect(Doc.read(doc, 'variables.home.name')).toBe('Broncos')
      expect(Doc.read(doc, 'variables.away.name')).toBe('Vandals')
    })

    it('deletes the key when the value means nothing', () => {
      run(doc, 'set', { 'variables.note': 'temporary' })
      run(doc, 'set', { 'variables.note': '' })

      expect(Doc.read(doc, 'variables.note')).toBeUndefined()
      expect(Doc.keys(doc)).not.toContain('variables.note')
    })

    it('keeps a literal zero', () => {
      run(doc, 'set', { 'variables.home.score': 0 })
      expect(Doc.read(doc, 'variables.home.score')).toBe(0)
    })
  })

  describe('merge', () => {
    it('leaves existing values alone when the incoming one is empty', () => {
      run(doc, 'set', { 'variables.home.name': 'Broncos' })
      run(doc, 'merge', { 'variables.home.name': '', 'variables.away.name': 'Vandals' })

      expect(Doc.read(doc, 'variables.home.name')).toBe('Broncos')
      expect(Doc.read(doc, 'variables.away.name')).toBe('Vandals')
    })
  })

  describe('toggle', () => {
    it('flips from cold, treating absent as off', () => {
      run(doc, 'toggle', 'toggles.lowerthird')
      expect(Doc.read(doc, 'toggles.lowerthird')).toBe(true)

      run(doc, 'toggle', 'toggles.lowerthird')
      expect(Doc.read(doc, 'toggles.lowerthird')).toBeUndefined()
    })
  })

  describe('only', () => {
    it('activates one member of a group and clears the rest', () => {
      const group = ['toggles.a', 'toggles.b', 'toggles.c']

      run(doc, 'only', { group, active: 'toggles.b' })

      expect(Doc.read(doc, 'toggles.b')).toBe(true)
      expect(Doc.read(doc, 'toggles.a')).toBeUndefined()
      expect(Doc.read(doc, 'toggles.c')).toBeUndefined()
    })

    it('clears the whole group when nothing is active', () => {
      run(doc, 'only', { group: ['toggles.a'], active: 'toggles.a' })
      run(doc, 'only', { group: ['toggles.a'], active: null })

      expect(Doc.read(doc, 'toggles.a')).toBeUndefined()
    })
  })

  describe('increment', () => {
    it('promotes a plain value into a counter, keeping it as the base', () => {
      run(doc, 'set', { 'variables.home.score': 7 })
      run(doc, 'increment', { 'variables.home.score': 1 })

      expect(Doc.read(doc, 'variables.home.score')).toBe(8)
      expect(Doc.isCounter(doc, 'variables.home.score')).toBe(true)
    })

    it('defaults to a step of one', () => {
      run(doc, 'increment', 'variables.home.score')
      expect(Doc.read(doc, 'variables.home.score')).toBe(1)
    })

    it('does not leave a stale copy in the plain state map', () => {
      run(doc, 'set', { 'variables.home.score': 3 })
      run(doc, 'increment', { 'variables.home.score': 1 })

      expect(Doc.stateOf(doc).has('variables.home.score')).toBe(false)
      expect(Doc.keys(doc)).toContain('variables.home.score')
    })
  })

  describe('swap', () => {
    it('trades values pairwise, outermost first', () => {
      run(doc, 'set', { 'variables.home.name': 'Broncos', 'variables.home.score': 3, 'variables.away.score': 1, 'variables.away.name': 'Vandals' })
      run(doc, 'swap', ['variables.home.name', 'variables.home.score', 'variables.away.score', 'variables.away.name'])

      expect(Doc.read(doc, 'variables.home.name')).toBe('Vandals')
      expect(Doc.read(doc, 'variables.away.name')).toBe('Broncos')
      expect(Doc.read(doc, 'variables.home.score')).toBe(1)
      expect(Doc.read(doc, 'variables.away.score')).toBe(3)
    })

    it('swaps counters through their base', () => {
      run(doc, 'increment', { 'variables.home.score': 4 })
      run(doc, 'increment', { 'variables.away.score': 2 })
      run(doc, 'swap', ['variables.home.score', 'variables.away.score'])

      expect(Doc.read(doc, 'variables.home.score')).toBe(2)
      expect(Doc.read(doc, 'variables.away.score')).toBe(4)
    })
  })

  describe('timer', () => {
    it('stores an absolute target so no peer has to tick', () => {
      const before = Date.now()

      run(doc, 'timer', { 'timers.break': 90_000 })

      const timer = Doc.read(doc, 'timers.break')

      expect(timer.duration).toBe(90_000)
      expect(timer.ts).toBeGreaterThanOrEqual(before + 90_000)
    })

    it('clears on a zero duration', () => {
      run(doc, 'timer', { 'timers.break': 90_000 })
      run(doc, 'timer', { 'timers.break': 0 })

      expect(Doc.read(doc, 'timers.break')).toBeUndefined()
    })

    it('accepts an absolute target, for a wall-clock countdown', () => {
      const at = Date.now() + 3_600_000

      run(doc, 'timer', { 'timers.show': { at, input: '19:00' } })

      expect(Doc.read(doc, 'timers.show')).toMatchObject({ ts: at, input: '19:00' })
    })

    it('derives a duration from an absolute target', () => {
      const at = Date.now() + 60_000

      run(doc, 'timer', { 'timers.show': { at } })

      expect(Doc.read(doc, 'timers.show').duration).toBeGreaterThan(58_000)
    })

    it('clears rather than starting a countdown already in the past', () => {
      run(doc, 'timer', { 'timers.show': { at: Date.now() - 1_000 } })

      expect(Doc.read(doc, 'timers.show')).toBeUndefined()
    })

    it('omits input when none was given, so the stored object stays clean', () => {
      run(doc, 'timer', { 'timers.break': 90_000 })

      expect(Doc.read(doc, 'timers.break')).not.toHaveProperty('input')
    })
  })

  describe('clear', () => {
    it('wipes only the requested prefix', () => {
      run(doc, 'set', { 'variables.a': 1, 'toggles.b': true })
      run(doc, 'increment', { 'variables.score': 2 })
      run(doc, 'clear', { prefix: 'variables' })

      expect(Doc.read(doc, 'variables.a')).toBeUndefined()
      expect(Doc.read(doc, 'variables.score')).toBeUndefined()
      expect(Doc.read(doc, 'toggles.b')).toBe(true)
    })

    it('wipes everything with no prefix', () => {
      run(doc, 'set', { 'variables.a': 1, 'toggles.b': true })
      run(doc, 'clear')

      expect(Doc.keys(doc)).toEqual([])
    })
  })

  describe('registry', () => {
    it('runs a studio-supplied mutation alongside the built-ins', () => {
      const registry = {
        ...mutations,
        'demo:reset-scores'(ctx) {
          ctx.write([
            ['variables.home.score', 0],
            ['variables.away.score', 0],
          ])
        },
      }

      apply(doc, registry, 'increment', { 'variables.home.score': 5 })
      apply(doc, registry, 'demo:reset-scores')

      expect(Doc.read(doc, 'variables.home.score')).toBe(0)
    })

    it('refuses an unknown mutation instead of failing silently', () => {
      expect(() => run(doc, 'nope', {})).toThrow(/Unknown Velcro mutation: nope/)
    })
  })

  describe('snapshot', () => {
    it('flattens counters and plain values together', () => {
      run(doc, 'set', { 'variables.home.name': 'Broncos' })
      run(doc, 'increment', { 'variables.home.score': 2 })

      expect(Doc.snapshot(doc)).toEqual({ 'variables.home.name': 'Broncos', 'variables.home.score': 2 })
    })
  })
})
