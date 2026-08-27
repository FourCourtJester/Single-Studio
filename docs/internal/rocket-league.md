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
