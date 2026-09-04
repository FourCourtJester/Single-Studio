import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rocketLeague, RocketLeagueHandler } from '../src/index'

// The other way in. A studio that wants the feed itself rather than a named hook
// subscribes to `*` and gets every event with its name in front -- which is how you
// find out what the game actually sends before deciding what to react to.

const sockets = []

class FakeSocket {
  constructor(url) {
    this.url = url
    this.listeners = {}
    sockets.push(this)
  }

  addEventListener(type, fn) {
    ;(this.listeners[type] ??= []).push(fn)
  }

  close() {}

  open() {
    for (const fn of this.listeners.open ?? []) fn()
  }

  /**
   * One frame, shaped the way the game shapes it: `Data` is a JSON *string* inside
   * the JSON frame, not an object. Sending an object here is what let a
   * double-encoded payload reach a studio unparsed -- every shape read `undefined`
   * and reported zero, and the suite was perfectly happy.
   */
  send(Event, Data) {
    for (const fn of this.listeners.message ?? []) fn({ data: JSON.stringify({ Event, Data: JSON.stringify(Data) }) })
  }
}

const listening = (Handler) => {
  const plugin = rocketLeague(Handler).create({
    mutate: vi.fn(),
    owner: () => true,
    studio: 's',
    config: { host: '127.0.0.1', port: 49122, path: '', stateEvery: 250 },
  })

  plugin.open()
  sockets[0].open()

  return plugin
}

beforeEach(() => {
  sockets.length = 0
  vi.stubGlobal('WebSocket', FakeSocket)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('taking the whole feed', () => {
  it('hands a subclass every event, named, through "*"', () => {
    const seen = []

    class MyShow extends RocketLeagueHandler {
      static handles = { ...RocketLeagueHandler.handles, '*': 'onAny' }

      onAny(name, payload) {
        seen.push([name, payload])
      }
    }

    listening(MyShow)
    sockets[0].send('GoalScored', { Scorer: { Name: 'Ada' }, GoalSpeed: 90 })

    expect(seen.map(([name]) => name)).toEqual(['goal'])
  })

  it('hands it over once, not once per emit path', () => {
    // The emitter fans out to `*` itself, prepending the name. A plugin that also
    // emits `'*'` by hand delivers everything twice -- which looks like the game
    // sending duplicates, and is the sort of thing a studio would work around with
    // deduplication rather than report.
    const seen = []

    class MyShow extends RocketLeagueHandler {
      static handles = { ...RocketLeagueHandler.handles, '*': 'onAny' }

      onAny(name) {
        seen.push(name)
      }
    }

    listening(MyShow)
    sockets[0].send('GoalScored', { Scorer: { Name: 'Ada' } })
    sockets[0].send('MatchEnded', { WinnerTeamNum: 1 })

    expect(seen).toEqual(['goal', 'matchEnded'])
  })

  it('gives onState the whole tick, normalised', () => {
    const seen = []

    class MyShow extends RocketLeagueHandler {
      onState(state) {
        seen.push(state)
      }
    }

    listening(MyShow)
    sockets[0].send('UpdateState', { MatchGuid: 'm1', Game: { TimeSeconds: 42, Ball: { Speed: 9 } }, Players: [] })

    expect(seen[0]).toMatchObject({ match: 'm1', seconds: 42, ballSpeed: 9 })
  })
})
