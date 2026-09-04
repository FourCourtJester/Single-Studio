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

  it('falls back to the port the game listens on when nothing is configured', () => {
    // The one test that pins the default. Every other one hands a port over, which
    // is how a wrong default goes unnoticed -- the plugin connects perfectly in the
    // suite and nowhere else. The 49122 above is deliberately *not* the default, so
    // those tests fail if configuration is ignored.
    build(RocketLeagueHandler, { host: '', port: '' }).open()

    expect(sockets[0].url).toBe('ws://127.0.0.1:49124')
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

describe('the frequent events', () => {
  const hit = (speed) => ({ Players: [{ Name: 'A', TeamNum: 0 }], Ball: { PreHitSpeed: speed, PostHitSpeed: speed + 100, Location: { X: 1, Y: 2, Z: 3 } } })

  it('arrive as one dated list rather than one event each', async () => {
    // A dribble is a touch every few frames. Nobody cuts to a graphic for one, and
    // a studio writing on each would be doing the thing the throttle exists to
    // stop -- but they are exactly what a stats package wants afterwards, so
    // dropping them is not the answer either.
    vi.useFakeTimers()

    try {
      const { MyShow, spies } = watching(['onBallHits'])
      const plugin = build(MyShow)

      plugin.open()
      sockets[0].open()

      sockets[0].send('BallHit', hit(100))
      vi.advanceTimersByTime(20)
      sockets[0].send('BallHit', hit(200))
      vi.advanceTimersByTime(20)
      sockets[0].send('BallHit', hit(300))

      // Nothing yet: no leading edge, or a burst would cost two emits instead of
      // the one it should.
      expect(spies.onBallHits).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)

      expect(spies.onBallHits).toHaveBeenCalledTimes(1)

      const [hits] = spies.onBallHits.mock.calls[0]

      expect(hits.map((one) => one.before)).toEqual([100, 200, 300])
      // Dated on the way in, because that is what batching would otherwise
      // destroy: twelve touches handed over together are a dribble or twelve
      // separate touches depending on when each happened.
      expect(hits[1].at - hits[0].at).toBe(20)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keep each kind in its own list', async () => {
    vi.useFakeTimers()

    try {
      const { MyShow, spies } = watching(['onBallHits', 'onBoostPickups'])
      const plugin = build(MyShow)

      plugin.open()
      sockets[0].open()

      sockets[0].send('BallHit', hit(100))
      sockets[0].send('BoostPickup', { Player: { Name: 'A', TeamNum: 0 }, BoostAmount: 100 })
      sockets[0].send('BallHit', hit(200))

      vi.advanceTimersByTime(100)

      expect(spies.onBallHits.mock.calls[0][0]).toHaveLength(2)
      expect(spies.onBoostPickups.mock.calls[0][0]).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('say nothing at all in a window where nothing happened', async () => {
    vi.useFakeTimers()

    try {
      const { MyShow, spies } = watching(['onBallHits'])
      const plugin = build(MyShow)

      plugin.open()
      sockets[0].open()

      vi.advanceTimersByTime(1_000)

      expect(spies.onBallHits).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('do not hold back the events that mean something', async () => {
    // The guard on over-applying this. A goal batched for a tenth of a second is a
    // graphic a tenth of a second late, for no saving worth having -- goals happen
    // a few times a match.
    const { MyShow, spies } = watching(['onGoal', 'onStatfeed', 'onCrossbar'])
    const plugin = build(MyShow)

    plugin.open()
    sockets[0].open()

    sockets[0].send('GoalScored', { Scorer: { Name: 'A', TeamNum: 0 } })
    sockets[0].send('StatfeedEvent', { EventName: 'Demolish' })
    sockets[0].send('CrossbarHit', { BallSpeed: 90 })

    expect(spies.onGoal).toHaveBeenCalledTimes(1)
    expect(spies.onStatfeed).toHaveBeenCalledTimes(1)
    expect(spies.onCrossbar).toHaveBeenCalledTimes(1)
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

  it('will not go faster than ten a second, whatever is typed', async () => {
    // The ceiling, not a default. Nothing on a stream changes visibly more often
    // than this, and every emit a handler turns into a write is four megabytes a
    // match at the rate the game is capable of.
    const { MyShow, spies } = watching(['onState'])
    const plugin = build(MyShow, { stateEvery: 8 })

    plugin.open()
    sockets[0].open()

    const clock = vi.spyOn(Date, 'now')

    // Ten ticks across 90ms: inside the floor, outside the number that was typed.
    for (let i = 0; i < 10; i += 1) {
      clock.mockReturnValue(1_000 + i * 10)
      sockets[0].send('UpdateState', tick(0, 0, i))
    }

    expect(spies.onState).toHaveBeenCalledTimes(1)

    clock.mockReturnValue(1_100)
    sockets[0].send('UpdateState', tick(0, 0, 99))

    expect(spies.onState).toHaveBeenCalledTimes(2)
  })

  it('holds the newest tick and discards the ones behind it', async () => {
    // Replaced, not queued: there is no value in yesterday's tick, and a studio
    // that received three in a burst would write three times for one picture.
    vi.useFakeTimers()

    try {
      const { MyShow, spies } = watching(['onState'])
      const plugin = build(MyShow, { stateEvery: 100 })

      plugin.open()
      sockets[0].open()

      sockets[0].send('UpdateState', tick(0, 0, 10))

      vi.advanceTimersByTime(40)
      sockets[0].send('UpdateState', tick(0, 0, 20))

      vi.advanceTimersByTime(40)
      sockets[0].send('UpdateState', tick(0, 0, 30))

      // One so far -- the leading edge -- and two now held, of which only the
      // second is worth anything.
      expect(spies.onState).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(100)

      expect(spies.onState).toHaveBeenCalledTimes(2)
      expect(spies.onState.mock.calls[1][0].players[0].boost).toBe(30)
    } finally {
      vi.useRealTimers()
    }
  })

  it('still delivers the last tick after the feed goes quiet', async () => {
    // The reason for holding one rather than dropping it. The whistle goes, the
    // ticks stop, and what a studio was told last should be the final state of the
    // match rather than a moment before it.
    vi.useFakeTimers()

    try {
      const { MyShow, spies } = watching(['onState'])
      const plugin = build(MyShow, { stateEvery: 100 })

      plugin.open()
      sockets[0].open()

      sockets[0].send('UpdateState', tick(0, 0, 10))
      sockets[0].send('UpdateState', tick(3, 2, 99))

      // Two ticks back to back: the first goes out on the leading edge, the second
      // is inside the window and is held.
      expect(spies.onState).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(200)

      expect(spies.onState).toHaveBeenCalledTimes(2)
      expect(spies.onState.mock.calls[1][0].players[0].boost).toBe(99)
    } finally {
      vi.useRealTimers()
    }
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
