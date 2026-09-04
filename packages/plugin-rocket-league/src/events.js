// Rocket League's Stats API payloads, in the shape a studio would have written.
//
// The wire format is Unreal's house style: PascalCase throughout, booleans prefixed
// `b`, teams as numbers, and one event whose name is spelled differently from the
// other twenty-one. None of that is wrong and all of it is the engine's, not a
// show's. A studio author should write `onGoalScored({ scorer })` without ever
// learning what `bOvertime` is called or which team is 0.

import { formatDuration } from '@single-studio/core/worker'

/** Blue is 0 and orange is 1. Everybody says the colours; nobody says the numbers. */
export const SIDES = ['blue', 'orange']

export const sideOf = (teamNum) => SIDES[Number(teamNum)] ?? null

/**
 * A player, wherever one appears.
 *
 * `Shortcut` is the number the in-game spectator keys use, which is genuinely
 * useful for a "press 3 for this player" overlay, so it is kept under a name that
 * says so.
 */
const player = (raw) =>
  raw
    ? {
        name: raw.Name ?? null,
        id: raw.PrimaryId ?? null,
        team: Number(raw.TeamNum ?? 0),
        side: sideOf(raw.TeamNum),
        spectatorKey: raw.Shortcut ?? null,
      }
    : null

const location = (raw) => (raw ? { x: raw.X ?? 0, y: raw.Y ?? 0, z: raw.Z ?? 0 } : null)

/** The last person to touch the ball, which several events carry identically. */
const lastTouch = (raw) => (raw ? { player: player(raw.Player), speed: raw.Speed ?? 0 } : null)

/**
 * One player's full row from a tick.
 *
 * Everything the API sends, renamed. Kept whole rather than trimmed because a tick
 * is where a studio goes looking for anything unusual, and the alternative is
 * guessing now which of twenty fields somebody will want later.
 */
const playerState = (raw) => ({
  ...player(raw),
  score: raw?.Score ?? 0,
  goals: raw?.Goals ?? 0,
  shots: raw?.Shots ?? 0,
  assists: raw?.Assists ?? 0,
  saves: raw?.Saves ?? 0,
  touches: raw?.Touches ?? 0,
  demos: raw?.Demos ?? 0,
  boost: raw?.Boost ?? 0,
  speed: raw?.Speed ?? 0,
  loadout: raw?.Loadout ?? [],
  hasCar: Boolean(raw?.bHasCar),
  boosting: Boolean(raw?.bBoosting),
  onGround: Boolean(raw?.bOnGround),
  onWall: Boolean(raw?.bOnWall),
  powersliding: Boolean(raw?.bPowersliding),
  supersonic: Boolean(raw?.bSupersonic),
  demolished: Boolean(raw?.bDemolished),
  demolishedBy: player(raw?.Attacker),
})

const team = (raw) => ({
  name: raw?.Name ?? null,
  team: Number(raw?.TeamNum ?? 0),
  side: sideOf(raw?.TeamNum),
  score: raw?.Score ?? 0,
  // Hex without a `#`, which is exactly one character away from being usable as a
  // CSS colour and will be pasted straight into a style by somebody.
  colour: raw?.ColorPrimary ? `#${raw.ColorPrimary}` : null,
  colourSecondary: raw?.ColorSecondary ? `#${raw.ColorSecondary}` : null,
})

/** The whole tick. */
export const gameState = (data) => ({
  match: data?.MatchGuid ?? null,
  players: (data?.Players ?? []).map(playerState),
  teams: (data?.Game?.Teams ?? []).map(team),
  seconds: data?.Game?.TimeSeconds ?? null,
  overtime: Boolean(data?.Game?.bOvertime),
  elapsed: data?.Game?.Elapsed ?? null,
  frame: data?.Game?.Frame ?? null,
  ballSpeed: data?.Game?.Ball?.Speed ?? 0,
  arena: data?.Game?.Arena ?? null,
  replay: Boolean(data?.Game?.bReplay),
  // Who the spectator camera is on, which is what a "now watching" lower third
  // reads and the only way to know it.
  watching: data?.Game?.bHasTarget ? player(data.Game.Target) : null,
  winner: data?.Game?.bHasWinner ? (data.Game.Winner ?? null) : null,
})

/**
 * The score, as the two numbers a scoreboard wants.
 *
 * Pulled out of the tick because `GoalScored` says who scored and not what the
 * score became -- so a studio that only listened to goals would be counting them
 * itself, and would be wrong the first time it missed one.
 */
export const scoreOf = (data) => {
  const teams = data?.Game?.Teams ?? []
  const find = (num) => teams.find((entry) => Number(entry?.TeamNum) === num)?.Score ?? 0

  return { blue: find(0), orange: find(1) }
}

export const EVENTS = {
  MatchCreated: { emit: 'matchCreated', shape: () => ({}) },
  MatchInitialized: { emit: 'matchReady', shape: () => ({}) },
  CountdownBegin: { emit: 'countdown', shape: () => ({}) },
  RoundStarted: { emit: 'roundStarted', shape: () => ({}) },
  MatchPaused: { emit: 'paused', shape: () => ({}) },
  MatchUnpaused: { emit: 'unpaused', shape: () => ({}) },
  MatchEnded: {
    emit: 'matchEnded',
    shape: (data) => ({ winner: Number(data?.WinnerTeamNum ?? 0), winnerSide: sideOf(data?.WinnerTeamNum) }),
  },
  MatchDestroyed: { emit: 'matchDestroyed', shape: () => ({}) },
  PodiumStart: { emit: 'podium', shape: () => ({}) },

  GoalScored: {
    emit: 'goal',
    shape: (data) => ({
      scorer: player(data?.Scorer),
      assist: player(data?.Assister),
      side: sideOf(data?.Scorer?.TeamNum),
      speed: data?.GoalSpeed ?? 0,
      at: data?.GoalTime ?? null,
      where: location(data?.ImpactLocation),
      lastTouch: lastTouch(data?.BallLastTouch),
    }),
  },

  GoalReplayStart: { emit: 'replayStart', shape: () => ({}) },
  // The one worth noticing. A graphic that waits for the end is already late: the
  // cut back to play has happened. This is the cue to start animating in.
  GoalReplayWillEnd: { emit: 'replayEnding', shape: () => ({}) },
  GoalReplayEnd: { emit: 'replayEnd', shape: () => ({}) },

  BallHit: {
    emit: 'ballHit',
    shape: (data) => ({
      by: player(data?.Players?.[0]),
      before: data?.Ball?.PreHitSpeed ?? 0,
      after: data?.Ball?.PostHitSpeed ?? 0,
      where: location(data?.Ball?.Location),
    }),
  },

  CrossbarHit: {
    emit: 'crossbar',
    shape: (data) => ({
      speed: data?.BallSpeed ?? 0,
      force: data?.ImpactForce ?? 0,
      where: location(data?.BallLocation),
      lastTouch: lastTouch(data?.BallLastTouch),
    }),
  },

  BoostPickup: {
    emit: 'boostPickup',
    shape: (data) => ({ by: player(data?.Player), amount: data?.BoostAmount ?? 0, kind: data?.BoostType ?? null, where: location(data?.Location) }),
  },

  ClockUpdatedSeconds: {
    emit: 'clock',
    /*
     * `text` alongside `seconds`, because every studio receiving this wants the same
     * `mm:ss` and would otherwise write it -- badly, at first, since the minute
     * boundary and the padding are where hand-rolled clocks go wrong.
     *
     * The framework's own formatter, not a local one, so a clock from a plugin and a
     * clock from `Timer` read identically on the same scoreboard.
     */
    shape: (data) => {
      const seconds = Number(data?.TimeSeconds) || 0

      return { seconds, text: formatDuration(seconds * 1000), overtime: Boolean(data?.bOvertime) }
    },
  },

  PlayerJoined: { emit: 'playerJoined', shape: (data) => ({ name: data?.PlayerName ?? null, id: data?.PrimaryId ?? null }) },
  PlayerLeft: { emit: 'playerLeft', shape: (data) => ({ name: data?.PlayerName ?? null, id: data?.PrimaryId ?? null }) },

  ReplayCreated: { emit: 'replaySaved', shape: (data) => ({ file: data?.FileName ?? null, at: data?.Date ?? null }) },

  // Spelled with a lower-case f, alone among twenty-two otherwise-PascalCase
  // events. A listener registered for `StatFeedEvent` never fires and nothing says
  // why, so the plugin answers to both and emits one name.
  StatfeedEvent: {
    emit: 'statfeed',
    shape: (data) => ({
      what: data?.EventName ?? null,
      kind: data?.Type ?? null,
      by: player(data?.MainTarget),
      to: player(data?.SecondaryTarget),
    }),
  },
}

/** Both spellings of the one event Psyonix spelled twice. */
const ALIASES = { StatFeedEvent: 'StatfeedEvent' }

/**
 * One message from the socket, as the event a studio hears.
 *
 * `UpdateState` is deliberately absent from the table: it is the tick, it arrives
 * up to 120 times a second, and it is handled separately so that its cost is a
 * decision rather than an accident.
 *
 * @param {string} type
 * @param {unknown} data
 */
export function normalise(type, data) {
  const name = ALIASES[type] ?? type
  const known = EVENTS[name]

  return {
    name: known?.emit ?? name,
    payload: { ...(known ? known.shape(data) : {}), raw: data },
  }
}
