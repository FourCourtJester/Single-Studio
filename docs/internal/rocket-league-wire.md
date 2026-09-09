# Rocket League: what the game actually sends

Measured against real matches, September 2026, with a studio driving live graphics.
Everything here **contradicts or completes** `rocket-league.md`, which was transcribed
from Psyonix's pre-2.72 documentation because CI could not reach the source.

Method: a harness between the socket and the store, surveying every field of every
payload across whole matches. Four findings, in order of how much they cost.

## 1. `GoalScored` fires twice for every goal — and the second one is real

Measured at exactly 2:1 across three matches: 14 events against 7 goals, 8 against 4,
10 against 5. `MatchCreated 0` on one of them, so it is not match boundaries.

**The second is not a duplicate frame.** It arrives from inside the goal replay: the
game is showing the goal again and reporting it again, which is honest of it. The
corroboration is that the stat feed does *not* double — `StatfeedEvent` totals matched
the tick's counters exactly (37 events against 32 counter increments plus five
`MVP`/`Win`), so it is this event specifically.

**What it costs a studio that does not know.** Anything counting goals is wrong by
double. Anything acting on a goal acts twice — in our case a scene change scheduled
three seconds after each, which meant a cut to the replay scene arriving *after* the
kickoff, long past any replay.

**The guard.** `bReplay` is on the tick, and `GoalReplayStart` / `GoalReplayEnd`
bracket it more precisely. Ignoring goals between them is exact.

This deserves a line in the plugin's own docs, because every studio will hit it and
none of them will guess it.

## 2. `UpdateState` during a replay describes the replay

The same fact, generalised, and worth stating separately because it is easy to miss.
While a replay is playing the tick is describing that footage: positions retrace,
boost drains a second time, the camera target is the replay's camera.

A studio reading the tick through a replay will rewind its own scoreboard, and any
figure derived from *change* rather than from a value — boost spent, distance
travelled, possession — is counted twice.

The plugin cannot decide this for a studio, but it should say it.

## 3. `PrimaryId` is in three payloads and nowhere else

Confirmed across three matches:

| Payload | `PrimaryId` |
| --- | --- |
| `UpdateState.Players[]` | always (3837/3837, 30696/30696) |
| `PlayerJoined` / `PlayerLeft` | always (8/8) |
| `GoalScored.Scorer` | **never** (0/22) |
| `GoalScored.Assister`, `BallLastTouch.Player` | never |
| `BallHit.Players[0]` | never (0/284) |
| `BoostPickup.Player` | never (0/780) |
| `StatfeedEvent.MainTarget` / `SecondaryTarget` | never (0/60) |
| `UpdateState.Game.Target` | never (0/4885) |

**`dev/replay.mjs` is wrong about this.** It puts a `PrimaryId` on `GoalScored.Scorer`,
which the game never does. A studio keying players by id passes every test and every
replay run, and fails the moment it meets a match — the camera target, ball touches
and the whole stat feed stop resolving.

The only workable key is the **name**. Worth saying outright in the plugin's docs,
since `PrimaryId` is the obvious choice and it is a trap.

## 4. Falsy values are omitted, not sent

The game leaves a field out rather than sending `false` or `0`. Across one match:

```
Name          30696/30696 present     bDemolished       97/97 present, all true
Boost         20601/30696 present     bOnWall         2167/2167 present, all true
bBoosting      3144/3144 present      bPowersliding    613/613 present, all true
```

Every boolean is present-and-true or absent. So **"never true" and "never sent" are
indistinguishable on the wire**, which matters for anybody diagnosing a field that
looks dead: `Boolean(undefined)` is `false`, and a mistyped field name looks exactly
like a feature nobody used.

The plugin's `?? 0` and `Boolean(...)` already handle it correctly. The note is for
whoever debugs the next field.

**`Attacker` is never sent at all**, in any state, including through demolitions. So
`demolishedBy` is permanently null and the plugin reads a field that does not exist.
Who demolished whom is available — it is `StatfeedEvent` with `MainTarget` and
`SecondaryTarget` — but not there.

## What to change

1. **`dev/replay.mjs`**: drop `PrimaryId` from `GoalScored.Scorer`; emit `GoalScored`
   twice around a replay; omit falsy fields rather than sending them. Each of those
   is a real behaviour the replay currently contradicts, and the plugin's tests agree
   with the replay rather than with the game.
2. **`plugin-rocket-league` docs**: the doubled goal, the replay tick, and name-keying.
3. **`rocket-league.md`**: fold in the table above and strike `Attacker`.
