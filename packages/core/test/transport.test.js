import { afterEach, describe, expect, it } from 'vitest'

import { createVelcroHost } from '../src/velcro/host'
import { statusChannelFor } from '../src/velcro/channels'

// How the worker reaches a page, and why it now does it twice.
//
// A BroadcastChannel post from a worker is fire-and-forget: no acknowledgement, no
// retry, and no way for either end to notice one went missing. This codebase has
// already been bitten by that once -- a subscription's opening value stopped riding
// the channel for exactly this reason -- and the same failure kept turning up in
// the shapes that were still on it. A board that missed the single message saying
// the show had arrived, or saying who holds the room, sat there looking connected
// and wrong until somebody reloaded it.
//
// So everything goes down the port as well. The host already knows which ports
// asked for which path, so the direct answer is the more precise of the two roads,
// not a simulation of the fan-out. These tests watch the port only.

let live = []

const host = (config = {}) => {
  const made = createVelcroHost({ persist: false, ...config })

  live.push(made)

  return made
}

/** A page, watching only what arrives down its own port. */
const page = (made) => {
  const { port1, port2 } = new MessageChannel()
  const seen = []

  port1.onmessage = ({ data }) => seen.push(data)
  port1.start()
  made.connect(port2)
  live.push({ close: () => (port1.close(), port2.close()) })

  return { port: port1, seen }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

const valuesFor = (seen, path) => seen.filter((message) => message?.type === 'value' && message.path === path).map((message) => message.value)

afterEach(() => {
  for (const made of live) made.close?.()
  live = []
})

describe('a change reaching a page', () => {
  it('arrives down the port, not only over the channel', async () => {
    const made = host({ name: `direct-${Math.random()}` })
    const { port, seen } = page(made)

    await made.started

    port.postMessage({ type: 'subscribe', path: 'variables.home.name' })
    await settle()

    port.postMessage({ type: 'mutate', name: 'set', payload: { 'variables.home.name': 'Vanguard' } })
    await settle()

    expect(valuesFor(seen, 'variables.home.name')).toContain('Vanguard')
  })

  it('keeps arriving, so a page is not one lost message from being stale forever', async () => {
    // The shape of the bug this closes: not a value that never came, but a value
    // that came once and then stopped, with nothing to ask again.
    const made = host({ name: `keeps-${Math.random()}` })
    const { port, seen } = page(made)

    await made.started

    port.postMessage({ type: 'subscribe', path: 'variables.home.score' })
    await settle()

    for (const score of [1, 2, 3]) {
      port.postMessage({ type: 'mutate', name: 'set', payload: { 'variables.home.score': score } })
    }

    await settle()

    expect(valuesFor(seen, 'variables.home.score')).toEqual([undefined, 1, 2, 3])
  })

  it('goes only to the pages that asked for it', async () => {
    // The reason this is not just a broadcast with extra steps. The host knows who
    // subscribed, so a graphic watching the clock is not woken by the score.
    const made = host({ name: `targeted-${Math.random()}` })
    const watcher = page(made)
    const bystander = page(made)

    await made.started

    watcher.port.postMessage({ type: 'subscribe', path: 'variables.home.name' })
    bystander.port.postMessage({ type: 'subscribe', path: 'timers.break' })
    await settle()

    watcher.port.postMessage({ type: 'mutate', name: 'set', payload: { 'variables.home.name': 'Vanguard' } })
    await settle()

    expect(valuesFor(watcher.seen, 'variables.home.name')).toContain('Vanguard')
    expect(valuesFor(bystander.seen, 'variables.home.name')).toEqual([])
  })

  it('stops when the page says it has gone', async () => {
    const made = host({ name: `gone-${Math.random()}` })
    const { port, seen } = page(made)

    await made.started

    port.postMessage({ type: 'subscribe', path: 'variables.home.name' })
    await settle()

    port.postMessage({ type: 'bye' })
    await settle()

    const before = seen.length

    port.postMessage({ type: 'mutate', name: 'set', payload: { 'variables.home.name': 'Vanguard' } })
    await settle()

    expect(seen.length).toBe(before)
  })
})

describe('two roads, one order', () => {
  // The hazard the redundancy introduces, and the reason for the stamp. Two
  // transports are two queues with no ordering between them, so a value delayed on
  // one road can arrive after a newer value that came by the other. Applied, that is
  // a score going backwards on air -- produced by the very belt-and-braces meant to
  // stop a value going missing.

  it('ignores a copy that arrives after something newer', async () => {
    const made = host({ name: `ordered-${Math.random()}` })
    const { port, seen } = page(made)

    await made.started

    port.postMessage({ type: 'subscribe', path: 'variables.home.score' })
    await settle()

    port.postMessage({ type: 'mutate', name: 'set', payload: { 'variables.home.score': 1 } })
    port.postMessage({ type: 'mutate', name: 'set', payload: { 'variables.home.score': 2 } })
    await settle()

    const values = seen.filter((message) => message?.type === 'value' && message.path === 'variables.home.score')

    // Every message the host sends carries an increasing stamp, which is what makes
    // a late duplicate identifiable as old rather than merely identical.
    expect(values.map((message) => message.seq)).toEqual([...values.map((message) => message.seq)].sort((a, b) => a - b))
    expect(new Set(values.map((message) => message.seq)).size).toBe(values.length)
  })

  it('stamps status too, since a connection state going backwards reads as a fault', async () => {
    const made = host({ name: `stamped-${Math.random()}`, sync: { url: 'memory://relay', connect: () => ({ destroy() {} }) } })
    const { seen } = page(made)

    await made.started
    await settle()

    const stamps = seen.filter((message) => message?.type === 'sync').map((message) => message.seq)

    expect(stamps.length).toBeGreaterThan(0)
    expect(stamps.every((seq) => typeof seq === 'number')).toBe(true)
    expect(stamps).toEqual([...stamps].sort((a, b) => a - b))
  })
})

describe('status reaching a page', () => {
  it('arrives down the port as well as the channel', async () => {
    // `ready` is the one every page waits on, and the one whose loss is hardest to
    // diagnose: a board that never hears it looks like a board with no data.
    const name = `status-${Math.random()}`
    const made = host({ name })
    const { seen } = page(made)

    await made.started
    await settle()

    expect(seen.some((message) => message?.type === 'ready')).toBe(true)
  })

  it('reaches a page that connected before there was anything to say', async () => {
    const name = `late-${Math.random()}`
    const made = host({ name, sync: { url: 'memory://relay', connect: () => ({ destroy() {} }) } })
    const { seen } = page(made)

    await made.started
    await settle()

    const told = seen.filter((message) => message?.type === 'sync')

    expect(told.length).toBeGreaterThan(0)
    expect(told.at(-1).state).toBe('connected')
  })

  it('is still on the channel too, for anything listening there', async () => {
    // Belt and braces, deliberately. The port is the guarantee; the channel is what
    // a page that has not yet opened a port -- or a second tab -- is listening on.
    const name = `both-${Math.random()}`
    const channel = new BroadcastChannel(statusChannelFor(name))
    const heard = []

    channel.onmessage = ({ data }) => heard.push(data)
    live.push({ close: () => channel.close() })

    const made = host({ name })

    await made.started
    await settle()

    expect(heard.some((message) => message?.type === 'ready')).toBe(true)
  })
})
