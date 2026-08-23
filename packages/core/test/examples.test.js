import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'

import * as Doc from '../src/velcro/doc'
import { apply, mutations } from '../src/velcro/mutations'

// The worked examples from docs/data.md, run.
//
// Documentation that has never been executed is a guess about the API, and this
// page is the one a studio copies from on day one. Every mutation below is the
// code in that document, transcribed rather than adapted -- if a rename here makes
// this file fail, the document is wrong and not the other way round.

const sync = (a, b) => {
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)))
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)))
}

// -- src/mutations/roster.js -------------------------------------------------

const roster = {
  'roster:add'(ctx, player) {
    if (!player?.name) return

    ctx.append({ path: 'variables.roster', value: { name: player.name, seed: player.seed ?? null } })
  },

  'roster:drop'(ctx, key) {
    ctx.unset(`variables.roster.${key}`)
  },

  'roster:rename'(ctx, { key, name }) {
    ctx.patch({ path: `variables.roster.${key}`, value: { name } })
  },
}

// -- src/mutations/sponsors.js -----------------------------------------------

const sponsors = {
  'sponsors:queue'(ctx, slot) {
    ctx.push({ path: 'variables.sponsors', value: slot })
  },

  'sponsors:drop'(ctx, at) {
    ctx.pull({ path: 'variables.sponsors', at })
  },

  'sponsors:move'(ctx, { from, to }) {
    ctx.move({ path: 'variables.sponsors', from, to })
  },

  'sponsors:advance'(ctx) {
    const queue = ctx.read('variables.sponsors') ?? []

    if (queue.length < 2) return

    const rotated = [...queue.slice(1), queue[0]]

    ctx.write([
      ['variables.sponsors', rotated],
      ['variables.sponsor.current', rotated[0]],
    ])
  },
}

// -- src/mutations/scoring.js ------------------------------------------------

const scoring = {
  'game:score'(ctx, { team, points = 1 }) {
    ctx.add(`variables.${team}.score`, points)
    ctx.stopwatch({ 'timers.game': 'pause' })
    ctx.append({
      path: 'variables.plays',
      value: { team, points, at: ctx.now(), period: ctx.read('variables.period') ?? '1' },
    })
    ctx.set({ 'toggles.bigplay': true })
  },
}

const registry = { ...mutations, ...roster, ...sponsors, ...scoring }
const run = (doc, name, payload) => apply(doc, registry, name, payload)
const names = (doc, options) => Doc.list(doc, 'variables.roster', options).map(([, player]) => player.name)

describe('a roster several operators build', () => {
  it('adds, drops and renames', () => {
    const doc = Doc.createDoc()

    run(doc, 'roster:add', { name: 'Ada Lovelace', seed: 3 })
    run(doc, 'roster:add', { name: 'Grace Hopper', seed: 1 })

    expect(names(doc, { by: 'seed' })).toEqual(['Grace Hopper', 'Ada Lovelace'])

    const [key] = Doc.list(doc, 'variables.roster', { by: 'seed' }).at(-1)

    run(doc, 'roster:rename', { key, name: 'Ada King' })
    expect(names(doc, { by: 'seed' })).toEqual(['Grace Hopper', 'Ada King'])

    // The rename merged: the seed somebody else set is still there.
    expect(Doc.read(doc, `variables.roster.${key}`)).toEqual({ name: 'Ada King', seed: 3 })

    run(doc, 'roster:drop', key)
    expect(names(doc)).toEqual(['Grace Hopper'])
  })

  it('writes nothing when the name is missing', () => {
    const doc = Doc.createDoc()

    run(doc, 'roster:add', { seed: 1 })
    run(doc, 'roster:add', undefined)

    expect(Doc.collect(doc, 'variables.roster')).toEqual({})
  })

  it('keeps both entries when two operators add at once', () => {
    const a = Doc.createDoc()
    const b = Doc.createDoc()

    run(a, 'roster:add', { name: 'Ada' })
    sync(a, b)

    run(a, 'roster:add', { name: 'Grace' })
    run(b, 'roster:add', { name: 'Katherine' })
    sync(a, b)

    expect(names(a).sort()).toEqual(['Ada', 'Grace', 'Katherine'])
    expect(Doc.list(a, 'variables.roster')).toEqual(Doc.list(b, 'variables.roster'))
  })

  it('sorts a player with no seed last, which is what the graphic shows', () => {
    const doc = Doc.createDoc()

    run(doc, 'roster:add', { name: 'Unseeded' })
    run(doc, 'roster:add', { name: 'Ada', seed: 2 })

    expect(names(doc, { by: 'seed' })).toEqual(['Ada', 'Unseeded'])
  })
})

describe('a sponsor queue one operator runs', () => {
  it('queues, drops, reorders and rotates', () => {
    const doc = Doc.createDoc()

    for (const slot of ['acme', 'globex', 'initech']) run(doc, 'sponsors:queue', slot)
    expect(Doc.read(doc, 'variables.sponsors')).toEqual(['acme', 'globex', 'initech'])

    run(doc, 'sponsors:move', { from: 2, to: 0 })
    expect(Doc.read(doc, 'variables.sponsors')).toEqual(['initech', 'acme', 'globex'])

    run(doc, 'sponsors:drop', 1)
    expect(Doc.read(doc, 'variables.sponsors')).toEqual(['initech', 'globex'])

    run(doc, 'sponsors:advance')
    expect(Doc.read(doc, 'variables.sponsors')).toEqual(['globex', 'initech'])
    expect(Doc.read(doc, 'variables.sponsor.current')).toBe('globex')
  })

  it('does nothing to a queue too short to rotate', () => {
    const doc = Doc.createDoc()

    run(doc, 'sponsors:queue', 'acme')
    run(doc, 'sponsors:advance')

    expect(Doc.read(doc, 'variables.sponsors')).toEqual(['acme'])
    expect(Doc.read(doc, 'variables.sponsor.current')).toBeUndefined()
  })

  it('rotates the queue and the slot on air together, as one change', () => {
    const doc = Doc.createDoc()

    run(doc, 'sponsors:queue', 'acme')
    run(doc, 'sponsors:queue', 'globex')

    let frames = 0
    doc.on('update', () => {
      frames += 1
    })

    run(doc, 'sponsors:advance')

    expect(frames).toBe(1)
  })
})

describe('a scoring play that changes four things', () => {
  it('changes all four, as one frame', () => {
    const doc = Doc.createDoc()

    run(doc, 'set', { 'variables.period': '2' })
    run(doc, 'stopwatch', { 'timers.game': 'start' })

    let frames = 0
    doc.on('update', () => {
      frames += 1
    })

    run(doc, 'game:score', { team: 'home', points: 3 })

    expect(Doc.read(doc, 'variables.home.score')).toBe(3)
    expect(Doc.read(doc, 'timers.game')).toHaveProperty('elapsed')
    expect(Doc.read(doc, 'toggles.bigplay')).toBe(true)

    const [[, play]] = Doc.list(doc, 'variables.plays')
    expect(play).toMatchObject({ team: 'home', points: 3, period: '2' })
    expect(typeof play.at).toBe('number')

    expect(frames).toBe(1)
  })

  it('adds up when two operators credit the same basket at once', () => {
    const a = Doc.createDoc()
    const b = Doc.createDoc()

    run(a, 'game:score', { team: 'home', points: 3 })
    run(b, 'game:score', { team: 'home', points: 3 })
    sync(a, b)

    // The point of ctx.add over read-then-write: six, not three.
    expect(Doc.read(a, 'variables.home.score')).toBe(6)
    expect(Object.keys(Doc.collect(a, 'variables.plays'))).toHaveLength(2)
  })

  it('defaults to one point when the payload does not say', () => {
    const doc = Doc.createDoc()

    run(doc, 'game:score', { team: 'away' })

    expect(Doc.read(doc, 'variables.away.score')).toBe(1)
  })
})
