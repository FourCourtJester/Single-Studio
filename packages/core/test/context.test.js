import { describe, expect, it } from 'vitest'

import * as Doc from '../src/velcro/doc'
import { apply, mutations } from '../src/velcro/mutations'

// What a studio's own mutation is handed. Everything documented in docs/data.md as
// being on `ctx` is asserted here, because a context that quietly lost a method
// would break studio code rather than framework code -- and nothing in this
// repository would notice.

describe('the mutation context', () => {
  it('offers every built-in as a method', () => {
    const doc = Doc.createDoc()
    const seen = []

    apply(doc, { ...mutations, probe: (ctx) => seen.push(...Object.keys(mutations).filter((name) => typeof ctx[name] !== 'function')) }, 'probe')

    expect(seen).toEqual([])
  })

  it('offers the reading and writing surface the docs promise', () => {
    const doc = Doc.createDoc()
    let ctx

    apply(doc, { ...mutations, probe: (given) => { ctx = given } }, 'probe')

    for (const name of ['read', 'collect', 'list', 'write', 'add', 'now', 'run']) expect(typeof ctx[name]).toBe('function')
    for (const name of ['doc', 'state', 'clientId']) expect(ctx[name]).toBeDefined()
  })

  it('composes built-ins into one mutation, in one transaction', () => {
    const doc = Doc.createDoc()
    const registry = {
      ...mutations,
      'feed:game'(ctx, game) {
        ctx.set({ 'variables.period': game.period })
        ctx.replace({ path: 'variables.standings', values: game.teams })
        ctx.append({ path: 'variables.log', key: game.period, value: { at: ctx.now() } })
      },
    }

    let frames = 0
    doc.on('update', () => {
      frames += 1
    })

    apply(doc, registry, 'feed:game', { period: 'Q2', teams: { ada: { points: 3 } } })

    expect(Doc.read(doc, 'variables.period')).toBe('Q2')
    expect(Doc.collect(doc, 'variables.standings')).toEqual({ ada: { points: 3 } })
    expect(Object.keys(Doc.collect(doc, 'variables.log'))).toEqual(['Q2'])

    // Three operations, one frame: the graphics see one change, not three.
    expect(frames).toBe(1)
  })

  it('runs another mutation by name, studio ones included', () => {
    const doc = Doc.createDoc()
    const registry = {
      ...mutations,
      'feed:teams'(ctx, teams) {
        ctx.replace({ path: 'variables.standings', values: teams })
      },
      'feed:game'(ctx, game) {
        ctx.run('feed:teams', game.teams)
        ctx.run('set', { 'variables.period': game.period })
      },
    }

    apply(doc, registry, 'feed:game', { period: 'Q3', teams: { grace: { points: 7 } } })

    expect(Doc.collect(doc, 'variables.standings')).toEqual({ grace: { points: 7 } })
    expect(Doc.read(doc, 'variables.period')).toBe('Q3')
  })

  it('says so when asked to run something that does not exist', () => {
    const doc = Doc.createDoc()
    const registry = { ...mutations, probe: (ctx) => ctx.run('feed:nope') }

    expect(() => apply(doc, registry, 'probe')).toThrow(/Unknown Velcro mutation: feed:nope/)
  })

  it('keeps ctx.set as the built-in when a studio names a mutation the same', () => {
    const doc = Doc.createDoc()
    const registry = {
      ...mutations,
      // A studio that shadows a built-in name -- legal, and occasionally deliberate.
      set(ctx) {
        ctx.write([['variables.shadowed', true]])
      },
      probe(ctx) {
        ctx.set({ 'variables.home.name': 'Broncos' })
      },
    }

    apply(doc, registry, 'probe')

    expect(Doc.read(doc, 'variables.home.name')).toBe('Broncos')
    expect(Doc.read(doc, 'variables.shadowed')).toBeUndefined()
  })

  it('reads a collection back inside the same mutation that wrote it', () => {
    const doc = Doc.createDoc()
    const registry = {
      ...mutations,
      'roster:cap'(ctx, limit) {
        ctx.append({ path: 'variables.roster', value: { name: 'Ada' } })
        ctx.append({ path: 'variables.roster', value: { name: 'Grace' } })
        ctx.append({ path: 'variables.roster', value: { name: 'Katherine' } })

        // Trim to the most recent, using what this transaction has already written.
        for (const [key] of ctx.list('variables.roster').slice(0, -limit)) {
          ctx.unset(`variables.roster.${key}`)
        }
      },
    }

    apply(doc, registry, 'roster:cap', 2)

    expect(ctx0(doc)).toEqual(['Grace', 'Katherine'])
  })
})

const ctx0 = (doc) => Doc.list(doc, 'variables.roster').map(([, member]) => member.name)
