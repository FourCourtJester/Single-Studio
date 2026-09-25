import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { IndexeddbPersistence } from 'y-indexeddb'

import * as Doc from '../src/velcro/doc'
import { definePlugin, PluginBase } from '../src/services/plugin'
import { createVelcroHost } from '../src/velcro/host'

/** Wait for something to become true, rather than guessing how many turns it takes. */
const until = async (predicate, why = 'condition', ms = 2_000) => {
  const deadline = Date.now() + ms

  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${why}`)
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

/** A page's end of the port, recording what the host says to it. */
const page = (host) => {
  const heard = []
  const port = {
    postMessage: (message) => heard.push(message),
    addEventListener: (_, listener) => (port.listener = listener),
    start() {},
    send: (data) => port.listener({ data }),
    heard,
  }

  host.connect(port)

  return port
}

/** What a fresh worker would find in the studio's database: an OBS restart. */
const reopen = async (name) => {
  const doc = Doc.createDoc()
  const persistence = new IndexeddbPersistence(name, doc)

  await persistence.whenSynced
  await persistence.destroy()

  return doc
}

const counting = () => {
  const plugin = definePlugin({
    name: 'counted',
    create: () => {
      const runtime = new PluginBase('counted')

      runtime.start = () => {
        plugin.starts += 1
      }

      return runtime
    },
  })

  plugin.starts = 0

  return plugin
}

const open = indexedDB.open.bind(indexedDB)

afterEach(() => {
  indexedDB.open = open
  vi.restoreAllMocks()
})

describe('resetting this machine', () => {
  it('keeps saving what the operator does afterwards', async () => {
    // The worker outlives the page's reload in OBS, because the browser sources are
    // still holding it. So the same host carries on after the wipe, and whatever
    // happens next has to reach the disk.
    const host = createVelcroHost({ name: 'reset-then-carry-on' })

    await host.started
    host.mutate('set', { 'team.name': 'Before the reset' })

    const board = page(host)

    board.send({ type: 'wipe', id: 1 })
    await until(() => board.heard.some((message) => message.type === 'wipe:result'), 'the wipe to finish')

    host.mutate('set', { 'team.name': 'After the reset' })

    // y-indexeddb writes each update as it happens; give the write a moment to land.
    await new Promise((resolve) => setTimeout(resolve, 50))

    const restarted = await reopen('reset-then-carry-on')

    expect(Doc.read(restarted, 'team.name')).toBe('After the reset')
  })

  it('still leaves nothing of the show from before it', async () => {
    const host = createVelcroHost({ name: 'reset-forgets' })

    await host.started
    host.mutate('set', { 'team.name': 'Before the reset', 'team.score': 3 })

    const board = page(host)

    board.send({ type: 'wipe', id: 1 })
    await until(() => board.heard.some((message) => message.type === 'wipe:result'), 'the wipe to finish')

    const restarted = await reopen('reset-forgets')

    expect(Doc.read(restarted, 'team.name')).toBeUndefined()
    expect(Doc.read(restarted, 'team.score')).toBeUndefined()
  })
})

describe('a machine whose storage will not open', () => {
  /** What Chrome does with a damaged profile: the open request fails. */
  const refuse = () => {
    indexedDB.open = () => {
      const request = { error: new DOMException('Internal error opening backing store', 'UnknownError') }

      setTimeout(() => request.onerror?.({ target: request }))

      return request
    }
  }

  it('still comes up, rather than waiting forever with nothing on screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    refuse()

    const host = createVelcroHost({ name: 'will-not-open' })
    const outcome = await Promise.race([host.started.then(() => 'up'), new Promise((resolve) => setTimeout(() => resolve('still waiting'), 1_000))])

    expect(outcome).toBe('up')
  })

  it('says so, in words that point at the storage', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    refuse()

    const host = createVelcroHost({ name: 'will-not-open-says-so' })

    await host.started

    expect(errors.mock.calls.map(([first]) => first)).toContain('[velcro] persistence unavailable, continuing in memory')
  })

  it('still starts its plugins, so the feeds keep driving the show', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    refuse()

    const plugin = counting()
    const host = createVelcroHost({ name: 'will-not-open-plugins', plugins: [plugin] })

    await host.started

    expect(plugin.starts).toBe(1)
  })

  it('still answers a page, and still takes an edit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    refuse()

    const host = createVelcroHost({ name: 'will-not-open-edits' })
    const board = page(host)

    board.send({ type: 'mutate', name: 'set', payload: { 'team.name': 'In memory' } })
    board.send({ type: 'peek', id: 7, path: 'team.name' })

    await until(() => board.heard.some((message) => message.type === 'peek:result'), 'the page to be answered')

    expect(board.heard.find((message) => message.type === 'peek:result').value).toBe('In memory')
  })
})

describe('a studio whose own onReady throws', () => {
  it('is reported as the studio’s mistake, not as storage failing', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const host = createVelcroHost({
      name: 'onready-throws',
      persist: false,
      onReady: () => {
        throw new Error('a typo in the studio')
      },
    })

    await host.started

    const said = errors.mock.calls.map(([first]) => first)

    expect(said).toContain('[velcro] the studio’s onReady threw')
    expect(said).not.toContain('[velcro] persistence unavailable, continuing in memory')
  })

  it('tells the pages it is ready once, and not as degraded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const host = createVelcroHost({
      name: 'onready-throws-once',
      persist: false,
      onReady: () => {
        throw new Error('a typo in the studio')
      },
    })
    const board = page(host)

    await host.started
    await until(() => board.heard.filter((message) => message.type === 'ready' && !('portId' in message)).length > 0, 'ready')

    const announced = board.heard.filter((message) => message.type === 'ready' && !('portId' in message))

    expect(announced).toHaveLength(1)
    expect(announced[0].degraded).toBeUndefined()
  })
})
