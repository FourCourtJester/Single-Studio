import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { createVelcroClient } from '../src/velcro/client'
import * as Doc from '../src/velcro/doc'
import { createVelcroHost } from '../src/velcro/host'
import { apply, mutations } from '../src/velcro/mutations'

// A mutation happens completely or not at all. See "Staging" in mutations.js.

/** Every update the document sends, which is what every page and peer would hear. */
const listening = (doc) => {
  const sent = []

  doc.on('update', (update) => sent.push(update))

  return sent
}

/** A studio mutation that gets partway and then trips over its own feet. */
const halfAGoal = {
  ...mutations,
  'show:goal': (ctx, { side }) => {
    ctx.increment({ [`${side}.score`]: 1 })
    ctx.set({ 'show.lastGoal': side })
    ctx.state.set('show.replay', true)

    // The typo that used to put half of this on air.
    throw new Error('period is not defined')
  },
}

afterEach(() => vi.restoreAllMocks())

describe('a mutation that throws partway', () => {
  it('changes nothing that it wrote before throwing', () => {
    const doc = Doc.createDoc()

    apply(doc, mutations, 'set', { 'home.score': 2, 'show.lastGoal': 'away' })

    expect(() => apply(doc, halfAGoal, 'show:goal', { side: 'home' })).toThrow(/period is not defined/)

    expect(Doc.read(doc, 'home.score')).toBe(2)
    expect(Doc.read(doc, 'show.lastGoal')).toBe('away')
    expect(Doc.read(doc, 'show.replay')).toBeUndefined()
  })

  it('sends nothing to the other pages and peers', () => {
    const doc = Doc.createDoc()
    const sent = listening(doc)

    expect(() => apply(doc, halfAGoal, 'show:goal', { side: 'home' })).toThrow()

    expect(sent).toHaveLength(0)
  })

  it('leaves a counter able to merge with a peer afterwards', () => {
    // The draft holds this client's subtotal as a value. Thrown away, it must not
    // leave the next increment adding onto a total that never happened.
    const a = Doc.createDoc()
    const b = Doc.createDoc()

    apply(a, mutations, 'set', { 'home.score': 0 })
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))

    expect(() => apply(a, halfAGoal, 'show:goal', { side: 'home' })).toThrow()

    apply(a, mutations, 'increment', { 'home.score': 1 })
    apply(b, mutations, 'increment', { 'home.score': 1 })
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))

    expect(Doc.read(a, 'home.score')).toBe(2)
    expect(Doc.read(b, 'home.score')).toBe(2)
  })
})

describe('a mutation that finishes', () => {
  it('lands every write at once, as one change', () => {
    const doc = Doc.createDoc()
    const sent = listening(doc)
    const registry = {
      ...mutations,
      'show:goal': (ctx, { side }) => {
        ctx.increment({ [`${side}.score`]: 1 })
        ctx.set({ 'show.lastGoal': side })
      },
    }

    apply(doc, registry, 'show:goal', { side: 'home' })

    expect(sent).toHaveLength(1)
    expect(Doc.read(doc, 'home.score')).toBe(1)
    expect(Doc.read(doc, 'show.lastGoal')).toBe('home')
  })

  it('reads back what it has already written, before any of it has landed', () => {
    const doc = Doc.createDoc()
    const seen = []
    const registry = {
      ...mutations,
      probe: (ctx) => {
        ctx.set({ 'a.b': 1 })
        seen.push(ctx.read('a.b'))
        ctx.increment({ 'a.c': 2 })
        ctx.increment({ 'a.c': 3 })
        seen.push(ctx.read('a.c'))
        ctx.unset('a.b')
        seen.push(ctx.read('a.b'), ctx.collect('a'))
      },
    }

    apply(doc, registry, 'probe')

    expect(seen).toEqual([1, 5, undefined, { c: 5 }])
  })

  it('stages a studio reaching for the raw map, not just the built-ins', () => {
    const doc = Doc.createDoc()
    const registry = {
      ...mutations,
      direct: (ctx) => {
        ctx.state.set('raw.one', 1)
        ctx.state.delete('raw.gone')

        if (ctx.state.get('raw.one') !== 1 || ctx.state.has('raw.gone')) throw new Error('the draft did not read its own writes')
      },
    }

    apply(doc, mutations, 'set', { 'raw.gone': 'here' })
    apply(doc, registry, 'direct')

    expect(Doc.read(doc, 'raw.one')).toBe(1)
    expect(Doc.read(doc, 'raw.gone')).toBeUndefined()
  })
})

describe('a mutation that awaits', () => {
  it('is told its late write went nowhere, instead of losing it quietly', async () => {
    const doc = Doc.createDoc()
    let late
    const registry = {
      ...mutations,
      waits: async (ctx) => {
        await null
        ctx.set({ 'late.value': 1 })
      },
    }

    late = apply(doc, registry, 'waits')

    await expect(late).rejects.toThrow(/after it had returned/)
    expect(Doc.read(doc, 'late.value')).toBeUndefined()
  })
})

describe('the board that pressed the button', () => {
  /** A real host and a real page, joined by a real channel. */
  const wired = (registry) => {
    const host = createVelcroHost({ name: 'staging', persist: false, mutations: registry })
    const pages = []

    const open = () => {
      const { port1, port2 } = new MessageChannel()

      host.connect(port2)

      const velcro = createVelcroClient({ name: 'staging', worker: () => ({ port: port1 }) })

      pages.push([port1, port2])

      return velcro
    }

    return { host, open, close: () => pages.forEach(([a, b]) => (a.close(), b.close())) }
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 30))

  it('hears which mutation failed and why', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { open, close } = wired(halfAGoal)
    const board = open()
    const heard = []

    board.onMutationError((failure) => heard.push(failure))
    await board.ready()

    board.mutate('show:goal', { side: 'home' })
    await settle()
    close()

    expect(heard).toEqual([{ name: 'show:goal', message: 'period is not defined' }])
  })

  it('is the only one told -- the other boards did not press anything', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { open, close } = wired(halfAGoal)
    const pressed = open()
    const other = open()
    const heard = { pressed: 0, other: 0 }

    pressed.onMutationError(() => (heard.pressed += 1))
    other.onMutationError(() => (heard.other += 1))
    await Promise.all([pressed.ready(), other.ready()])

    pressed.mutate('show:goal', { side: 'home' })
    await settle()
    close()

    expect(heard).toEqual({ pressed: 1, other: 0 })
  })

  it('still says so in its own console when nothing on the page is listening', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { open, close } = wired(halfAGoal)
    const graphic = open()

    await graphic.ready()
    errors.mockClear()

    graphic.mutate('show:goal', { side: 'home' })
    await settle()
    close()

    expect(errors.mock.calls.map(([first]) => first)).toContain('[velcro] "show:goal" failed and changed nothing: period is not defined')
  })

  it('keeps working afterwards', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { host, open, close } = wired(halfAGoal)
    const board = open()

    await board.ready()
    board.mutate('show:goal', { side: 'home' })
    board.mutate('increment', { 'home.score': 1 })
    await settle()
    close()

    expect(Doc.read(host.doc, 'home.score')).toBe(1)
    expect(Doc.read(host.doc, 'show.lastGoal')).toBeUndefined()
  })
})
