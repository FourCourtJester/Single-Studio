# Rocket League Stats API

Notes for building the plugin. Transcribed from Psyonix's developer documentation,
which this container cannot reach — `rocketleague.com` and the Steam mirror are both
blocked by the egress proxy, so **this file is the working reference** and anything
not written down here has not been checked.

Psyonix shipped the API as a raw TCP socket. **v2.72 (4 August 2026) added WebSocket
support and the ability to issue commands to the game.** Every community project
older than that runs a local TCP-to-WebSocket bridge; with 2.72 a browser connects
directly, which is the whole reason this is worth building — a studio stays static
files with nothing to run alongside it.

## Still to confirm

- The WebSocket URL and port after 2.72, and the `TAStatsAPI.ini` /
  `DefaultStatsAPI.ini` keys that enable it. Pre-2.72 the TCP port was 49123, under
  `[TAGame.MatchStatsExporter_TA]`, with `PacketSendRate` capped at 120 and 0
  disabling the feature. Config is read at client start, so changes need a restart.
- Whether anything is emitted on connect, or whether a client sees nothing until the
  next tick.

Neither blocks the plugin. **Host, port and path are config fields**, so the address
is a settings change on the night rather than a release — which is why they exist
rather than being constants. The second question is why there is no watchdog: the
game is silent whenever nobody is in a match, so a silence budget would drop a
healthy connection every time an operator sat in the menu.

## Envelope

Every message is the same two fields.

```json
{ "Event": "EventName", "Data": {} }
```

Commands go the other way in the mirror image — `Command` naming it, `Data` holding
the variables — covering spectator viewpoint, replay load and seek, playback speed,
and HUD visibility. **Commands are deferred**; see the plan in
[architecture](architecture.md#services). Ingress first.

Every payload carries `MatchGuid`, which is the only thing tying a stream of events
to one match. Worth keying off rather than assuming a socket sees one match: a
client that stays connected across a lobby sees several.

## Events

| Event                 | Fires                                | Payload beyond `MatchGuid`                                                                                  |
| --------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `UpdateState`         | Every tick, at `PacketSendRate`      | `Players[]`, `Game{}` — the whole state. See below                                                          |
| `MatchCreated`        | Match exists                         | —                                                                                                           |
| `MatchInitialized`    | Match ready                          | —                                                                                                           |
| `CountdownBegin`      | Kickoff countdown                    | —                                                                                                           |
| `MatchPaused`         |                                      | —                                                                                                           |
| `MatchUnpaused`       |                                      | —                                                                                                           |
| `MatchEnded`          |                                      | `WinnerTeamNum`                                                                                             |
| `MatchDestroyed`      | Match torn down                      | —                                                                                                           |
| `PodiumStart`         | Podium sequence                      | —                                                                                                           |
| `GoalScored`          |                                      | `GoalSpeed`, `GoalTime`, `ImpactLocation{X,Y,Z}`, `Scorer{}`, `Assister{}`, `BallLastTouch{Player{},Speed}` |
| `GoalReplayStart`     |                                      | —                                                                                                           |
| `GoalReplayWillEnd`   | Shortly before the replay ends       | —                                                                                                           |
| `GoalReplayEnd`       |                                      | —                                                                                                           |
| `BallHit`             |                                      | `Players[]`, `Ball{PreHitSpeed,PostHitSpeed,Location{X,Y,Z}}`                                               |
| `CrossbarHit`         |                                      | `BallLocation{X,Y,Z}`, `BallSpeed`, `ImpactForce`, `BallLastTouch{Player{},Speed}`                          |
| `BoostPickup`         |                                      | `Player{}`, `Location{X,Y,Z}`, `BoostAmount`, `BoostType`, `bReplay`                                        |
| `ClockUpdatedSeconds` | Each whole second                    | `TimeSeconds`, `bOvertime`                                                                                  |
| `PlayerJoined`        |                                      | `PlayerName`, `PrimaryId`                                                                                   |
| `PlayerLeft`          |                                      | `PlayerName`, `PrimaryId`                                                                                   |
| `RoundStarted`        |                                      | —                                                                                                           |
| `ReplayCreated`       | A replay file is written             | `FileName`, `Date` (`2026-06-05 18:42:13`)                                                                  |
| `StatfeedEvent`       | Anything the in-game stat feed shows | `EventName`, `Type`, `MainTarget{}`, `SecondaryTarget{}`                                                    |

**`StatfeedEvent` is spelled with a lower-case `f`**, alone among the events, which
are otherwise PascalCase throughout. A listener registered for `StatFeedEvent` will
simply never fire, and nothing will say why. The plugin should normalise event names
on the way out so no studio author ever meets this.

`StatfeedEvent` is also the general one: it carries whatever the in-game feed would
show, named in `EventName` (`Demolish`, and presumably saves, epic saves, hat
tricks), with `MainTarget` as who did it and `SecondaryTarget` as who it was done
to. Worth treating as the extension point — new feed events will arrive here rather
than as new top-level events.

`GoalReplayWillEnd` is the one worth noticing. A graphic that waits for
`GoalReplayEnd` is already late — the cut back to play has happened. This is the
cue to start animating in.

## `UpdateState`

The tick. Everything else is a notification that something in here changed.

`Players[]` — `Name`, `PrimaryId` (`Steam|123|0`), `Shortcut`, `TeamNum`, `Score`,
`Goals`, `Shots`, `Assists`, `Saves`, `Touches`, `CarTouches`, `Demos`, `Loadout[]`,
`bHasCar`, `Speed`, `Boost`, `bBoosting`, `bOnGround`, `bOnWall`, `bPowersliding`,
`bDemolished`, `Attacker{Name,Shortcut,TeamNum}`, `bSupersonic`, `PickupClass`.

`Game{}` — `Teams[]` (`Name`, `TeamNum`, `Score`, `ColorPrimary`, `ColorSecondary`,
as hex without a `#`), `PlaylistId`, `TimeSeconds`, `bOvertime`, `Frame`, `Elapsed`,
`Ball{Speed,TeamNum}`, `bReplay`, `bHasWinner`, `Winner`, `Arena`, `bHasTarget`,
`Target{Name,Shortcut,TeamNum}`.

`Target` is who the spectator camera is on, which is what a "now watching" lower
third reads.

## What this means for the plugin

**30Hz is measured, not feared.** `packages/core/test/tick-rate.test.js` runs 300 ticks and counts
the update frames the document actually produced:

| What the feed sends, 30Hz for 10s  | Frames | Why                                  |
| ---------------------------------- | ------ | ------------------------------------ |
| Names and scores, nothing changing | 1      | `writeOne` compares before it writes |
| Same, one goal midway              | 2      | One per thing that happened          |
| A clock ticking once a second      | 10     | The rate of the value, not the feed  |
| 6 players' boost and speed         | 300    | The values really are all different  |

So the resend rate costs nothing. **The rate of change is the whole cost**, and only
genuine telemetry has one — roughly 4.8 kB/s for six players' boost and speed, every
byte persisted to IndexedDB and replicated to every peer, for numbers that are stale
before anybody reads them.

That is not fixable by comparison and should not go in the document. A live boost
meter wants a transient path that fans out to graphics without being stored, the
way presence already works. Nothing needs it yet, and it should not be built until
something does.

**The tick is the problem to solve, not the events.** At a `PacketSendRate` of 30,
`UpdateState` carries every player's boost and speed thirty times a second. Writing
that into a replicated document would be thirty transactions a second, each
persisted and each sent to every peer — for values a scoreboard does not show.

So the plugin emits, and the studio author decides what is worth storing. That is
the whole argument for an emitter rather than a plugin that writes: the framework
cannot know that this show wants goal counts and not boost meters, and a plugin that
guessed would be wrong for everybody who wanted the other one.

The plugin should still make the cheap cases easy — a `goal` event with the score
already extracted beats making every author read `Game.Teams[].Score` out of a tick.

**Naming.** The payloads are PascalCase with Hungarian booleans (`bOvertime`), which
is Unreal's house style and not this framework's. The plugin should emit
`{ overtime: true }`. A studio author should not have to know what engine the game
was written in.

## What was built

`packages/plugin-rocket-league`. Two files: `events.js` turns a wire payload into the
shape a studio would have written, and `index.js` is the socket, the throttle and the
handler skeleton.

Wire name to emitted name, where they differ:

| Wire                                                      | Emitted                                      |
| --------------------------------------------------------- | -------------------------------------------- |
| `MatchInitialized`                                        | `matchReady`                                 |
| `CountdownBegin`                                          | `countdown`                                  |
| `GoalScored`                                              | `goal`                                       |
| `GoalReplayStart` / `GoalReplayWillEnd` / `GoalReplayEnd` | `replayStart` / `replayEnding` / `replayEnd` |
| `ClockUpdatedSeconds`                                     | `clock`                                      |
| `ReplayCreated`                                           | `replaySaved`                                |
| `StatfeedEvent`, and `StatFeedEvent`                      | `statfeed`                                   |
| `UpdateState`                                             | `score`, `state`                             |

The rest keep their names, lower-cased at the front. `normalise` answers to both
spellings of the stat feed event, so nobody meets the lower-case `f`.

`UpdateState` is the only one that becomes two events, and the only one with a
policy:

- **`score`** whenever either number changes, throttle or no throttle. `GoalScored`
  says who scored, not what the score became, so a studio counting goals itself is
  wrong the first time it misses one.
- **`state`** at most every `stateEvery` milliseconds, default 250. A typed `0`
  switches it off and goals and the clock still arrive; a _cleared_ field is not a
  typed zero and falls back to the default.

Booleans lose their `b`, teams gain a `side` of `blue` or `orange`, and team colours
gain the `#` that makes them CSS.
