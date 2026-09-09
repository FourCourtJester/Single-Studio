import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { gameSockets } from './support'

import { rocketLeague, RocketLeagueHandler } from '../src/index'

// The other way in. A studio that wants the feed itself rather than a named hook
// subscribes to `*` and gets every event with its name in front -- which is how you
// find out what the game actually sends before deciding what to react to.

const { sockets, Socket, reset } = gameSockets()

const listening = (Handler) => {
  const plugin = rocketLeague(Handler).create({
    mutate: vi.fn(),
    owner: () => true,
    studio: 's',
    config: { host: '127.0.0.1', port: 49122, path: '' },
  })

  plugin.open()
  sockets[0].open()

  return plugin
}

beforeEach(() => {
  reset()
  vi.stubGlobal('WebSocket', Socket)
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
    sockets[0].frame('GoalScored', { Scorer: { Name: 'Ada' }, GoalSpeed: 90 })

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
    sockets[0].frame('GoalScored', { Scorer: { Name: 'Ada' } })
    sockets[0].frame('MatchEnded', { WinnerTeamNum: 1 })

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
    sockets[0].frame('UpdateState', { MatchGuid: 'm1', Game: { TimeSeconds: 42, Ball: { Speed: 9 } }, Players: [] })

    expect(seen[0]).toMatchObject({ match: 'm1', seconds: 42, ballSpeed: 9 })
  })
})
