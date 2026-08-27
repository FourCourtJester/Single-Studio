import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rocketLeague, RocketLeagueHandler } from '../src/index'

const sockets = []

class FakeSocket {
  constructor(url) {
    this.url = url
    this.listeners = {}
    this.closed = false
    sockets.push(this)
  }

  addEventListener(type, fn) {
    ;(this.listeners[type] ??= []).push(fn)
  }

  close() {
    this.closed = true
  }

  open() {
    for (const fn of this.listeners.open ?? []) fn()
  }

  send(Event, Data) {
    for (const fn of this.listeners.message ?? []) fn({ data: JSON.stringify({ Event, Data }) })
  }
}

const build = (Handler = RocketLeagueHandler, over = {}) =>
  rocketLeague(Handler).create({
    mutate: vi.fn(),
    owner: () => true,
    studio: 's',
    config: { host: '127.0.0.1', port: 49122, path: '', stateEvery: 250, ...over },
  })

/** Watch what a studio's handler is told. */
const watching = (methods) => {
  const spies = Object.fromEntries(methods.map((name) => [name, vi.fn()]))

  class MyShow extends RocketLeagueHandler {}

  for (const name of methods) {
    MyShow.prototype[name] = function forward(...args) {
      spies[name](...args)
    }
  }

  return { MyShow, spies }
}

beforeEach(() => {
  sockets.length = 0
  vi.stubGlobal('WebSocket', FakeSocket)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the address', () => {
  it('is a bare host and port, which is the usual shape', () => {
    build().open()

    expect(sockets[0].url).toBe('ws://127.0.0.1:49122')
  })

  it('takes a path when one is configured, however it is typed', () => {
    // The endpoint's exact shape is documented where this could not read it, so a
    // path is a settings change on the night rather than a release.
    build(RocketLeagueHandler, { path: 'ws' }).open()
    build(RocketLeagueHandler, { path: '/ws' }).open()

    expect(sockets[0].url).toBe('ws://127.0.0.1:49122/ws')
    expect(sockets[1].url).toBe('ws://127.0.0.1:49122/ws')
  })

  it('falls back to what the ini file usually says', () => {
    build(RocketLeagueHandler, { host: '', port: '' }).open()

    expect(sockets[0].url).toBe('ws://127.0.0.1:49122')
  })
})

describe('events', () => {
  it('reach the handler in the plugin’s shape', async () => {
    const { MyShow, spies } = watching(['onGoal'])
    const plugin = build(MyShow)

    plugin.open()
    sockets[0].open()

    sockets[0].send('GoalScored', { Scorer: { Name: 'PlayerA', TeamNum: 0 }, GoalSpeed: 87.3 })

    expect(spies.onGoal).toHaveBeenCalledWith(expect.objectContaining({ side: 'blue', speed: 87.3 }))
  })

  it('ignore a frame with no Event rather than throwing', async () => {
    const plugin = build()

    plugin.open()
    sockets[0].open()

    expect(() => sockets[0].send(undefined, {})).not.toThrow()
  })
})

describe('the tick', () => {
  const tick = (blue, orange, boost = 50) => ({
    Players: [{ Name: 'A', TeamNum: 0, Boost: boost }],
    Game: {
      Teams: [
        { Name: 'Blue', TeamNum: 0, Score: blue },
        { Name: 'Orange', TeamNum: 1, Score: orange },
      ],
    },
  })

  it('gives the score the moment it changes, whatever the throttle says', async () => {
    // A scoreboard a quarter of a second late is a scoreboard that is wrong on the
    // replay.
    const { MyShow, spies } = watching(['onScore'])
    const plugin = build(MyShow, { stateEvery: 10_000 })

    plugin.open()
    sockets[0].open()

    sockets[0].send('UpdateState', tick(0, 0))
    sockets[0].send('UpdateState', tick(1, 0))

    expect(spies.onScore).toHaveBeenCalledTimes(2)
    expect(spies.onScore).toHaveBeenLastCalledWith({ blue: 1, orange: 0 })
  })

  it('says nothing about the score while nobody scores', async () => {
    const { MyShow, spies } = watching(['onScore'])
    const plugin = build(MyShow)

    plugin.open()
    sockets[0].open()

    for (let i = 0; i < 30; i += 1) sockets[0].send('UpdateState', tick(1, 0, i))

    expect(spies.onScore).toHaveBeenCalledTimes(1)
  })

  it('throttles the full state, because the game sends it up to 120 times a second', async () => {
    // Every one carries each player's boost and speed. A studio writing those into
    // a replicated document spends kilobytes a second on numbers already stale.
    const { MyShow, spies } = watching(['onState'])
    const plugin = build(MyShow, { stateEvery: 250 })

    plugin.open()
    sockets[0].open()

    const clock = vi.spyOn(Date, 'now')

    clock.mockReturnValue(1_000)
    sockets[0].send('UpdateState', tick(0, 0, 10))

    clock.mockReturnValue(1_100)
    sockets[0].send('UpdateState', tick(0, 0, 20))

    clock.mockReturnValue(1_400)
    sockets[0].send('UpdateState', tick(0, 0, 30))

    expect(spies.onState).toHaveBeenCalledTimes(2)
  })

  it('keeps the default when the field is cleared, rather than reading blank as off', async () => {
    // A number input that has been emptied reports NaN, and an older stored value
    // can be a string. Neither is somebody asking for silence -- only a typed 0 is.
    const { MyShow, spies } = watching(['onState'])

    for (const stateEvery of [Number.NaN, '', null, undefined]) {
      sockets.length = 0

      build(MyShow, { stateEvery }).open()
      sockets[0].open()
      sockets[0].send('UpdateState', tick(0, 0))
    }

    expect(spies.onState).toHaveBeenCalledTimes(4)
  })

  it('switches the state event off entirely at zero, and still reports goals', async () => {
    const { MyShow, spies } = watching(['onState', 'onScore'])
    const plugin = build(MyShow, { stateEvery: 0 })

    plugin.open()
    sockets[0].open()

    sockets[0].send('UpdateState', tick(1, 0))

    expect(spies.onState).not.toHaveBeenCalled()
    expect(spies.onScore).toHaveBeenCalledWith({ blue: 1, orange: 0 })
  })
})
