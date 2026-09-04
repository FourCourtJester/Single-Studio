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

- Which file and heading actually enable it. A connection has been made, so
  _something_ turns it on, but not which of `TAStatsAPI.ini` /
  `DefaultStatsAPI.ini` or whether `[TAGame.MatchStatsExporter_TA]`,
  `PacketSendRate` and the 120 cap carried over from the pre-2.72 TCP API. Config is
  read at client start, so changes need a restart.
- Whether anything is emitted on connect, or whether a client sees nothing until the
  next tick.
- Whether a StatsAPI file is there by default or has to be created. The folder is
  confirmed below; what is inside it is not.

## Confirmed on a real machine

The config directory on Windows:

```
%USERPROFILE%\Documents\My Games\Rocket League\TAGame\Config\
```

**A studio has connected to the real game at `ws://localhost:49124`.** That is the
first end-to-end confirmation this file has, and it settles the address: not the
49123 the pre-2.72 TCP socket used, and not the 49122 this plugin shipped with until
somebody looked. No path was needed. Both are the plugin's defaults now, and the
port is what `dev/replay.mjs` serves on.

`localhost` rather than `127.0.0.1` because that is what was tested. The two are not
always the same thing — `localhost` may resolve to `::1` first, and a server bound
only to IPv4 refuses it — so the one that has been seen to work is the one that
ships. The replay server binds every interface and answers to both, checked.

Checked by somebody with the game installed, which is the only way any of this gets
checked -- Psyonix's documentation is blocked from this container. It is the user's
config directory rather than the one beside the installed game, which is how every
other Rocket League setting works.

Worth recording why this section exists at all. The help panel used to name a single
path inside the install directory, in a numbered list, with no hedge -- while this
file had the same question filed under "still to confirm". The uncertainty was
written down and then lost on the way into user-facing text, and somebody following
the panel went looking for a file that was not there. Anything still on that list is
on it because it has not been checked, and the panel now says as much.

Neither of the remaining unknowns blocks the plugin. **Host, port and path are config fields**, so the address
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
and HUD visibility.

The mechanism for sending them exists — `SocketService.commands` and
`handler.command()`, see [architecture](architecture.md#commands) — and a command
sent in reaction to an event needs nothing more, because the machine that heard the
event is the machine that sends the command.

**The plugin's command table is empty, and the wire names are why.** They are
documented where this container cannot reach, and declaring six plausible strings
would ship a plugin whose commands the game ignores without a word — worse than one
with none, because `command()` refuses an unknown name loudly while a guessed name
would look like it worked. Filling the table in is a five-line change once the names
are to hand; an author who already knows one can send it directly with
`this.plugin.send({ Command, Data })`.

A command from a _remote operator_ is a different problem and stays deferred.

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

### At the rate the game is actually capable of

Measured at 120Hz, which is the cap `PacketSendRate` allows. Reading the feed is
free; the CPU figures are a fraction of one core over ten seconds of wall clock:

| At 120Hz                          | Cost            |
| --------------------------------- | --------------- |
| `JSON.parse` + score extraction   | 0.55% of a core |
| `JSON.parse` + full `gameState()` | 0.64% of a core |
| Writing changing telemetry        | 0.59% of a core |
| A peer applying it                | 0.54% of a core |

The ceiling is not CPU. It is that the document keeps history:

| 120Hz telemetry for | Document |
| ------------------- | -------- |
| 10s                 | 127 kB   |
| 60s                 | 828 kB   |
| 300s                | 4.2 MB   |

Linear and unbounded — 14 kB/s for as long as it runs, persisted to IndexedDB and
downloaded in full by every board that joins late.

The same 36,000 ticks driving an actual scoreboard — two names, two scores, a clock
— cost **300 update frames and 0.3 kB**. Four orders of magnitude apart, from
identical input, decided entirely by what a handler chooses to write. Which is the
argument for a plugin that emits rather than one that writes, in one table.

Not measured, because Node has neither: the IndexedDB write and the `postMessage`
fan-out to each open tab. Those are the untested part of the chain.

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

## Watching it work without the game

`pnpm --filter @single-studio/plugin-rocket-league replay` serves the Stats API shape
on `ws://localhost:49124` and plays a short match on a loop — kickoff, three goals
with their replay sequences, a demolition, a podium — then starts again. The demo
studio registers the plugin, so `pnpm fixture` plus that command is a moving
scoreboard with nothing installed.

It proves the plugin end to end and proves nothing about the wire format. Every frame
in it is one somebody typed from the same notes the parser was written from, so it
cannot disagree with the parser. **A capture from a real match is still the missing
piece**, and when there is one this should replay that, with the script as the
fallback.

Worth knowing while reading it: each client gets a fresh match from the top, which
the game does not do. A real client that stays connected across a lobby sees several
matches, which is why every payload carries `MatchGuid`.

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
| `BallHit`                                                 | `ballHits` (a list)                          |
| `BoostPickup`                                             | `boostPickups` (a list)                      |
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
- **`state`** at most every `stateEvery` milliseconds, default 250, **floored at
  100**. A typed `0` switches it off and goals and the clock still arrive; a
  _cleared_ field is not a typed zero and falls back to the default; a typed `8`
  becomes 100.

The floor is a decision rather than a measurement, though the measurements agree
with it: nothing on a stream changes visibly more than ten times a second, and every
emit a handler turns into a write is charged at the rates above. It is a floor and
not a default because a default is only the value somebody has not changed yet.

The state is **collected, not dropped**. The newest tick is held and handed on when
the window opens, rather than emitting whichever tick happens to land on a boundary.
The two look identical while the feed is running and differ the moment it stops:
with the second, a studio's last word on a match is a moment before the whistle. It
costs one held reference. Normalising only what is emitted is the other half of it —
`gameState()` runs ten times a second at most, whatever the feed does.

### Two collations, in opposite directions

`ballHit` and `boostPickup` are throttled too, and not the same way.

A dribble is a touch every few frames and six players crossing a pitch take boost
pads continuously. Neither is something a graphic changes for — nobody has ever cut
to a lower third because somebody touched the ball — but both are exactly what a
stats package wants afterwards. Dropping them would throw away the only thing they
are good for.

So the two throttles collate in opposite directions:

| Kind       | Example    | Between windows        | Handed over  |
| ---------- | ---------- | ---------------------- | ------------ |
| **Sample** | `state`    | Newest replaces oldest | The last one |
| **Fact**   | `ballHits` | Appended               | All of them  |

Each fact is dated on the way in, because that is the information batching would
otherwise destroy: twelve touches handed over together are a dribble or twelve
separate touches depending on when each happened, and by the time the batch arrives
there is nothing left to tell them apart with.

The name changes with the shape — `ballHits`, not `ballHit`. A studio author
overriding `onBallHit` that quietly started receiving an array would find out on
air; one overriding `onBallHits(hits)` is told by the signature.

Facts have no leading edge, unlike the tick. Sending the first one immediately and
batching the rest would mean a burst — the whole case this exists for — still costs
two emits where it should cost one. An empty window emits nothing at all.

Everything else is immediate. A goal held back a tenth of a second is a graphic a
tenth of a second late for no saving worth having; goals, the stat feed and the
whistle happen a few times a match.

Booleans lose their `b`, teams gain a `side` of `blue` or `orange`, and team colours
gain the `#` that makes them CSS.
