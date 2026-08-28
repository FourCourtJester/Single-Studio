// Rocket League, without Rocket League.
//
// The plugin is thirty-odd tests deep and has never met the game. Every frame in
// those tests is one somebody typed, so what they prove is that the parser does what
// we think the wire format is -- not that the wire format is what we think it is.
// This does not fix that. Only a capture from a real match does.
//
// What it fixes is the other half: nothing that reads Rocket League can be *seen*
// working without a Windows box, an install, and a match in progress. That is a slow
// loop for building a scoreboard, and an impossible one for anybody reviewing it.
//
// So this speaks the shape the documentation describes, on the port the plugin
// expects, and plays a short match on a loop: kickoff, a couple of goals with their
// replays, a demolition, and a podium. Point the plugin at 127.0.0.1:49122 and the
// board moves.
//
//   node dev/replay.mjs            # every client gets a fresh match
//   node dev/replay.mjs --port 49200
//   node dev/replay.mjs --rate 120 # what the game can actually do
//
// When a real capture exists, this should replay that instead of a script, and the
// script should be what it falls back to.

import { WebSocketServer } from 'ws'

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`)

  return at === -1 ? fallback : process.argv[at + 1]
}

const PORT = Number(arg('port', 49122))
const RATE = Number(arg('rate', 30))

const BLUE = 0
const ORANGE = 1

const NAMES = [
  ['Kestrel', 'Vireo', 'Merlin'],
  ['Ember', 'Tarn', 'Fennec'],
]

/** One player's row in a tick. Numbers wander so the telemetry is not suspiciously still. */
const player = (side, index, frame) => ({
  Name: NAMES[side][index],
  PrimaryId: `Steam|7656119800000${side}${index}|0`,
  Shortcut: side * 3 + index + 1,
  TeamNum: side,
  Score: 100 + index * 40,
  Goals: 0,
  Shots: index,
  Assists: 0,
  Saves: index % 2,
  Touches: 20 + index,
  CarTouches: 2,
  Demos: 0,
  Loadout: [],
  bHasCar: true,
  Speed: 700 + ((frame * 13 + index * 97 + side * 31) % 1500),
  Boost: (frame * 7 + index * 23 + side * 11) % 100,
  bBoosting: (frame + index) % 5 === 0,
  bOnGround: (frame + index) % 3 !== 0,
  bOnWall: false,
  bPowersliding: false,
  bDemolished: false,
  Attacker: null,
  bSupersonic: (frame + index) % 17 === 0,
  PickupClass: null,
})

/**
 * One connection, one match, played from the top.
 *
 * Per-client rather than one clock for everybody, so a board that reloads sees a
 * kickoff rather than joining whatever was already happening -- which is what you
 * want while building a graphic and not at all what the game does. The difference is
 * worth knowing about: a real client that stays connected across a lobby sees
 * several matches, which is why every payload carries `MatchGuid`.
 */
function play(socket) {
  const match = `replay-${Math.random().toString(36).slice(2, 10)}`
  const score = { [BLUE]: 0, [ORANGE]: 0 }
  const timers = []

  let clock = 300
  let frame = 0
  let live = false
  let replaying = false

  const send = (Event, Data = {}) => {
    if (socket.readyState !== socket.OPEN) return

    socket.send(JSON.stringify({ Event, Data: { MatchGuid: match, ...Data } }))
  }

  const at = (seconds, fn) => timers.push(setTimeout(fn, seconds * 1000))

  const teams = () => [
    { Name: 'Blue', TeamNum: BLUE, Score: score[BLUE], ColorPrimary: '0f7fff', ColorSecondary: 'ffffff' },
    { Name: 'Orange', TeamNum: ORANGE, Score: score[ORANGE], ColorPrimary: 'ff7f0f', ColorSecondary: 'ffffff' },
  ]

  const tick = () => {
    frame += 1

    send('UpdateState', {
      Players: [0, 1, 2].map((i) => player(BLUE, i, frame)).concat([0, 1, 2].map((i) => player(ORANGE, i, frame))),
      Game: {
        Teams: teams(),
        PlaylistId: 11,
        TimeSeconds: clock,
        bOvertime: false,
        Frame: frame,
        Elapsed: frame / RATE,
        Ball: { Speed: 400 + ((frame * 29) % 2200), TeamNum: BLUE },
        bReplay: replaying,
        bHasWinner: false,
        Winner: null,
        Arena: 'Stadium_P',
        bHasTarget: true,
        Target: { Name: NAMES[BLUE][frame % 3], Shortcut: (frame % 3) + 1, TeamNum: BLUE },
      },
    })
  }

  const goal = (side, scorer, assist) => {
    score[side] += 1

    send('GoalScored', {
      GoalSpeed: 60 + Math.round(Math.random() * 60),
      GoalTime: 300 - clock,
      ImpactLocation: { X: 120, Y: -5100, Z: 640 },
      Scorer: { Name: NAMES[side][scorer], PrimaryId: `Steam|7656119800000${side}${scorer}|0`, TeamNum: side, Shortcut: side * 3 + scorer + 1 },
      Assister: assist === undefined ? null : { Name: NAMES[side][assist], TeamNum: side, Shortcut: side * 3 + assist + 1 },
      BallLastTouch: { Player: { Name: NAMES[side][scorer], TeamNum: side }, Speed: 2100 },
    })

    // The replay sequence, which is the part a graphic actually cues off. Ending is
    // deliberately announced before the end: a graphic that waits for the end is
    // already late, because the cut back to play has happened.
    replaying = true
    send('GoalReplayStart')
    at(3.4, () => send('GoalReplayWillEnd'))
    at(4, () => {
      replaying = false
      send('GoalReplayEnd')
      send('RoundStarted')
    })
  }

  // A touch every few frames, in bursts, which is what a dribble looks like and the
  // reason the plugin batches these rather than emitting each one.
  const dribble = (count) => {
    for (let i = 0; i < count; i += 1) {
      at(i * 0.12, () =>
        send('BallHit', {
          Players: [{ Name: NAMES[BLUE][i % 3], TeamNum: BLUE }],
          Ball: { PreHitSpeed: 800 + i * 40, PostHitSpeed: 1200 + i * 60, Location: { X: i * 30, Y: 1200, Z: 95 } },
        }),
      )
    }
  }

  send('MatchCreated')
  at(0.5, () => send('MatchInitialized'))
  at(1, () => send('CountdownBegin'))
  at(4, () => {
    live = true
    send('RoundStarted')
  })

  // The clock, once a second, exactly as the game sends it.
  const ticking = setInterval(() => {
    if (!live || replaying) return

    clock = Math.max(0, clock - 1)
    send('ClockUpdatedSeconds', { TimeSeconds: clock, bOvertime: false })
  }, 1000)

  const ticker = setInterval(tick, 1000 / RATE)

  at(9, () => dribble(6))
  at(12, () => goal(BLUE, 0, 1))
  at(20, () =>
    send('BoostPickup', { Player: { Name: NAMES[ORANGE][0], TeamNum: ORANGE }, Location: { X: 0, Y: 0, Z: 70 }, BoostAmount: 100, BoostType: 'big' }),
  )
  at(21, () => dribble(9))
  at(24, () => goal(ORANGE, 1))
  at(32, () =>
    send('StatfeedEvent', {
      EventName: 'Demolish',
      Type: 'Demolition',
      MainTarget: { Name: NAMES[BLUE][2], TeamNum: BLUE },
      SecondaryTarget: { Name: NAMES[ORANGE][2], TeamNum: ORANGE },
    }),
  )
  at(36, () => goal(BLUE, 2, 0))
  at(44, () => {
    live = false
    send('MatchEnded', { WinnerTeamNum: score[BLUE] > score[ORANGE] ? BLUE : ORANGE })
  })
  at(47, () => send('PodiumStart'))
  at(52, () => {
    send('MatchDestroyed')
    stop()
    play(socket)
  })

  function stop() {
    clearInterval(ticker)
    clearInterval(ticking)
    for (const timer of timers) clearTimeout(timer)
  }

  socket.once('close', stop)
}

const server = new WebSocketServer({ port: PORT })

server.on('connection', (socket) => {
  console.log('[replay] a board connected; kicking off')
  play(socket)
})

console.log(`[replay] Rocket League Stats API on ws://127.0.0.1:${PORT} at ${RATE}Hz`)
console.log('[replay] set that host and port in Settings -> Plugins -> Rocket League')
