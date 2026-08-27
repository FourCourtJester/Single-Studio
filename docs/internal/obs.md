# OBS, over obs-websocket

Written against `obsproject/obs-websocket`'s own `docs/generated/protocol.md`, which
this container could fetch from raw.githubusercontent.com — so unlike the Rocket
League and Twitch notes, **the field names here are from the source rather than
from a reconstruction**.

## Why this one matters most

OBS is where the studio already lives. Knowing which scene is live lets a graphic
decide for itself rather than waiting to be told: a lower third that hides when the
camera cuts away, a scoreboard that only counts while the match scene is up, a LIVE
badge that is honest about the difference between connecting and connected.

It is also the plugin with the least setup. obs-websocket has shipped **inside** OBS
since 28, so there is nothing to install — Tools → WebSocket Server Settings, and
the defaults are `localhost:4455`.

## The handshake

```
OBS  → Hello (op 0)        obsStudioVersion, obsWebSocketVersion, rpcVersion,
                           authentication?: { challenge, salt }
     ← Identify (op 1)     rpcVersion, authentication?, eventSubscriptions
OBS  → Identified (op 2)   negotiatedRpcVersion
     ↔ Event (5) / Request (6) / RequestResponse (7)
```

**Authentication is two rounds and the order matters in both:**

```
secret = base64( sha256( password + salt ) )
auth   = base64( sha256( secret   + challenge ) )
```

Concatenating the other way round, or hashing the raw digest rather than its base64,
gives a string of the right length that is always wrong — and OBS rejects both
identically, so the error says nothing about which mistake it was.

`authentication` must be **absent**, not empty, when OBS is not asking. Auth switched
off is an ordinary configuration.

## Subscriptions

A bitmask of categories, and the plugin computes it from the events a studio asked
for rather than sending `All`.

| Category    | Bit      | Category    | Bit       |
| ----------- | -------- | ----------- | --------- |
| general     | `1 << 0` | outputs     | `1 << 6`  |
| config      | `1 << 1` | sceneItems  | `1 << 7`  |
| scenes      | `1 << 2` | mediaInputs | `1 << 8`  |
| inputs      | `1 << 3` | vendors     | `1 << 9`  |
| transitions | `1 << 4` | ui          | `1 << 10` |
| filters     | `1 << 5` | canvases    | `1 << 11` |

**`All` is not a constant.** `Canvases` joined it in obs-websocket 5.7.0, so "all"
is a different number to different versions of OBS. Computing from the events
actually wanted avoids the question and stops events crossing the socket to be
discarded.

The high-volume flags start at `1 << 16` (`InputVolumeMeters`, and friends) and are
never included by default, by OBS's own rule. `InputVolumeMeters` alone is dozens of
messages a second.

## Two things that are quiet when wrong

**OBS announces changes and never announces the present.** A studio that only
listened would not know the scene until somebody changed it — which on a steady show
could be the whole broadcast. The plugin asks `GetCurrentProgramScene` and
`GetStreamStatus` once, on connect.

**`outputActive` is true while the stream is still connecting.** A LIVE badge keyed
on it alone lights up before the stream is up. The plugin reads `outputState` as
well and reports `live` only for `STARTED`, with `settling` for the in-between.

## Requests

Correlated by `requestId`, not by arrival order — OBS may answer out of order, and
matching on arrival attaches one reply to another request's promise, which reads as
the wrong scene and says nothing.

Only reads are issued today: the plugin is ingress, consistent with the order agreed
for Rocket League. Writing (`SetCurrentProgramScene` and the rest) is the deferred
command work and needs the routing question answered first — a remote operator's
button press has to reach the machine running OBS, and there is no path for that
yet.

## Tested

| Module        | Covers                                                       | Tests |
| ------------- | ------------------------------------------------------------ | ----- |
| `protocol.js` | Auth hash, subscription mask, message classification, frames | 15    |
| `events.js`   | OBS payloads to shapes a studio would write                  | 12    |
| `index.js`    | Handshake, subscription scoping, priming, correlation        | 10    |

None needs OBS running. What is **not** tested is the one thing a fake socket
cannot check: that a real OBS accepts the auth string. The algorithm matches the
published one and the test pins its properties, but the first real connection is
still the first real proof.
