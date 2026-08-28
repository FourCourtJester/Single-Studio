import { describe, expect, it } from 'vitest'

import { gameState, normalise, scoreOf, sideOf } from '../src/events'

describe('sides', () => {
  it('are the colours everybody says, not the numbers nobody does', () => {
    expect(sideOf(0)).toBe('blue')
    expect(sideOf(1)).toBe('orange')
    expect(sideOf('0')).toBe('blue')
    expect(sideOf(9)).toBeNull()
  })
})

describe('the goal', () => {
  const data = {
    GoalSpeed: 87.3,
    GoalTime: 127.5,
    ImpactLocation: { X: 0, Y: -2944, Z: 320 },
    Scorer: { Name: 'PlayerA', Shortcut: 1, TeamNum: 0 },
    Assister: { Name: 'PlayerC', Shortcut: 3, TeamNum: 0 },
    BallLastTouch: { Player: { Name: 'PlayerA', Shortcut: 1, TeamNum: 0 }, Speed: 125 },
  }

  it('names who scored, who assisted, and for which side', () => {
    const { name, payload } = normalise('GoalScored', data)

    expect(name).toBe('goal')
    expect(payload).toMatchObject({
      scorer: expect.objectContaining({ name: 'PlayerA', side: 'blue', spectatorKey: 1 }),
      assist: expect.objectContaining({ name: 'PlayerC' }),
      side: 'blue',
      speed: 87.3,
    })
  })

  it('gives null rather than an empty player when nobody assisted', () => {
    // An unassisted goal is the common case, and `assist.name` on an empty object
    // renders as nothing while `assist` being null can be tested for.
    expect(normalise('GoalScored', { ...data, Assister: undefined }).payload.assist).toBeNull()
  })
})

describe('the event Psyonix spelled twice', () => {
  const data = {
    EventName: 'Demolish',
    Type: 'Demolition',
    MainTarget: { Name: 'PlayerA', TeamNum: 0 },
    SecondaryTarget: { Name: 'PlayerB', TeamNum: 1 },
  }

  it('is understood under the spelling the game actually sends', () => {
    // Lower-case f, alone among twenty-two otherwise-PascalCase events.
    const { name, payload } = normalise('StatfeedEvent', data)

    expect(name).toBe('statfeed')
    expect(payload).toMatchObject({ what: 'Demolish', by: expect.objectContaining({ name: 'PlayerA' }), to: expect.objectContaining({ name: 'PlayerB' }) })
  })

  it('and under the one people will type', () => {
    // A listener for the wrong spelling never fires and nothing says why, so the
    // plugin answers to both and emits one name.
    expect(normalise('StatFeedEvent', data).name).toBe('statfeed')
  })
})

describe('the clock and the whistle', () => {
  it('reads the b-prefixed booleans as booleans', () => {
    expect(normalise('ClockUpdatedSeconds', { TimeSeconds: 180, bOvertime: true }).payload).toMatchObject({ seconds: 180, overtime: true })
  })

  it('names the winning side as a side', () => {
    expect(normalise('MatchEnded', { WinnerTeamNum: 1 }).payload).toMatchObject({ winner: 1, winnerSide: 'orange' })
  })

  it('carries the replay file when one is written', () => {
    expect(normalise('ReplayCreated', { FileName: 'Stadium_P_2026-06-05_18-42', Date: '2026-06-05 18:42:13' }).payload).toMatchObject({
      file: 'Stadium_P_2026-06-05_18-42',
    })
  })
})

describe('the score', () => {
  const tick = {
    Game: {
      Teams: [
        { Name: 'Blue', TeamNum: 0, Score: 2 },
        { Name: 'Orange', TeamNum: 1, Score: 1 },
      ],
    },
  }

  it('comes out of the tick, because GoalScored does not carry it', () => {
    // A studio that only listened to goals would be counting them itself, and
    // would be wrong the first time it missed one.
    expect(scoreOf(tick)).toEqual({ blue: 2, orange: 1 })
  })

  it('reads by team number rather than by position in the array', () => {
    // Nothing promises blue comes first, and reading [0] and [1] silently swaps the
    // scoreboard when it does not.
    const backwards = { Game: { Teams: [tick.Game.Teams[1], tick.Game.Teams[0]] } }

    expect(scoreOf(backwards)).toEqual({ blue: 2, orange: 1 })
  })

  it('is zero-zero before a match rather than undefined', () => {
    expect(scoreOf({})).toEqual({ blue: 0, orange: 0 })
  })
})

describe('the tick', () => {
  const data = {
    MatchGuid: 'abc',
    Players: [
      {
        Name: 'PlayerA',
        PrimaryId: 'Steam|123|0',
        Shortcut: 1,
        TeamNum: 0,
        Score: 125,
        Goals: 1,
        Saves: 1,
        Boost: 45,
        Speed: 1200,
        bBoosting: true,
        bSupersonic: true,
        bDemolished: true,
        Attacker: { Name: 'PlayerB', Shortcut: 2, TeamNum: 1 },
        Loadout: ['body_grain'],
      },
    ],
    Game: {
      Teams: [{ Name: 'Blue', TeamNum: 0, Score: 1, ColorPrimary: '0000FF', ColorSecondary: '0000AA' }],
      TimeSeconds: 180,
      bOvertime: false,
      Elapsed: 50.2,
      Ball: { Speed: 850.5 },
      Arena: 'Stadium_P',
      bHasTarget: true,
      Target: { Name: 'PlayerA', Shortcut: 1, TeamNum: 0 },
      bHasWinner: false,
    },
  }

  it('renames every b-prefixed boolean into something readable', () => {
    const state = gameState(data)

    expect(state.players[0]).toMatchObject({ boosting: true, supersonic: true, demolished: true })
    expect(state.overtime).toBe(false)
  })

  it('says who demolished whom rather than leaving an Attacker field', () => {
    expect(gameState(data).players[0].demolishedBy).toMatchObject({ name: 'PlayerB', side: 'orange' })
  })

  it('makes the team colour a colour rather than six characters', () => {
    // Hex without a # is exactly one character from usable, and somebody will paste
    // it straight into a style.
    expect(gameState(data).teams[0].colour).toBe('#0000FF')
  })

  it('names who the spectator camera is on, which nothing else says', () => {
    expect(gameState(data).watching).toMatchObject({ name: 'PlayerA' })
  })

  it('gives no target rather than a phantom one when the camera is loose', () => {
    const loose = { ...data, Game: { ...data.Game, bHasTarget: false } }

    expect(gameState(loose).watching).toBeNull()
  })

  it('has no winner until there is one', () => {
    expect(gameState(data).winner).toBeNull()
    expect(gameState({ ...data, Game: { ...data.Game, bHasWinner: true, Winner: 'Blue' } }).winner).toBe('Blue')
  })
})

describe('anything the table has not caught up with', () => {
  it('passes through under its own name with the payload untouched', () => {
    const data = { SomethingNew: true }

    expect(normalise('SomeFutureEvent', data)).toEqual({ name: 'SomeFutureEvent', payload: { raw: data } })
  })

  it('carries raw on the known ones too', () => {
    const data = { TimeSeconds: 90, bOvertime: false }

    expect(normalise('ClockUpdatedSeconds', data).payload.raw).toBe(data)
  })
})
