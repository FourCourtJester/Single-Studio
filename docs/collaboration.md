# Collaboration plan

How Single Studio goes from one operator to several without giving up local-first
behaviour, GitHub Pages hosting, or the ability to run a show with no network at
all.

Nothing in this document ships in the MVP. It is written now because two of its
conclusions are already baked into the store — the PN-counter and the absolute
timer — and the rest has to not fight them later.

---

## The shape of the problem

The target setup is one streamer plus _n_ trusted operators:

- **One machine runs OBS.** The control surface runs as an OBS custom browser
  dock, which puts it in the same CEF process as every browser source. They share
  one `SharedWorker`, so the host machine is already self-contained.
- **Operators are elsewhere**, on their own laptops, doing production work the
  streamer shouldn't have to think about: scores, names, lower thirds, the crawl.
- **Operators never touch OBS.** Scene switching, recording, and transitions stay
  with whoever can see OBS. This is a deliberate v1 boundary, and it removes the
  hardest distributed-systems problem from the design (see
  [Commands](#why-there-are-no-commands-yet)).

So the thing being shared is _show data_, and only show data.

## Where the network boundary goes

The `SharedWorker` is the peer. Not the tab.

```
   streamer's machine (OBS + CEF)              operator's laptop
  ┌───────────────────────────────┐          ┌────────────────────┐
  │  dock ─┐                      │          │  dock ─┐           │
  │ source ├─ SharedWorker ◄──────┼── relay ─┼─► SharedWorker     │
  │ source ─┘     (Y.Doc)         │          │        (Y.Doc)     │
  └───────────────────────────────┘          └────────────────────┘
```

A studio with twelve browser sources is **one** peer on the network, not twelve.
Local fan-out is already solved by BroadcastChannel; the network layer only ever
sees machine-to-machine traffic. This falls out of the existing architecture
rather than being added to it.

Worth noting for later: cross-tab sharing is only load-bearing on the **host**,
which runs a dock plus a dozen sources. A companion operator runs one board in one
tab and shares it with nothing. So once the relay exists, a companion's store could
live in a dedicated worker — or on the main thread — and still participate fully.
That would drop the browser floor for companions to roughly "anything current",
leaving the module-SharedWorker requirement where it is actually needed. Not worth
building before the relay, but it is the natural fallback if a companion's browser
ever turns out to be a problem in practice.

## Transport: a WebSocket relay, not peer-to-peer

Decided on reliability grounds, and reinforced by a hard platform constraint:

|                     | In a SharedWorker? | Consequence                                                                                                                                                             |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WebSocket`         | yes                | The worker owns sync. Tabs stay dumb.                                                                                                                                   |
| `RTCPeerConnection` | **no**             | WebRTC is main-thread only. A tab has to own the connection and relay into the worker, which means leader election and failover when the operator closes the wrong tab. |

P2P would also still need a signalling server, and roughly 10–20% of real
connections need TURN, which is a relay by definition. "Serverless P2P" is not a
thing that exists. Given that a relay is unavoidable, taking it directly buys
simplicity, reliability, and a worker-resident transport.

**The app stays static.** The relay is a separate, tiny, user-deployed service and
its URL is runtime configuration — never baked into a build.

### Relay choice

Ship a **Cloudflare Durable Object** template in `packages/relay`. One object per
room, holding the document and rebroadcasting updates. Free tier covers a small
streamer comfortably, users deploy their own with one command, and we host
nothing. Advanced users can point at `y-websocket`, Hocuspocus, or y-sweet
instead — the endpoint is just a URL.

### What reliability actually means here

This is the argument for a CRDT rather than a server-authoritative store, and it
matters most for exactly the audience being targeted — someone who cannot afford
redundant infrastructure:

**If the relay dies mid-show, the broadcast does not stop.** The host keeps
rendering from its local `Y.Doc` and its own IndexedDB. Graphics never blank.
Remote operators can't push until it recovers; when it does, their queued edits
converge automatically. Nobody restarts anything.

A server-authoritative design turns relay downtime into blank lower thirds on
air. That difference is the whole point.

---

## What already accounts for this

Two decisions in the MVP exist because of this plan.

### Counters commute

`velcro/counter.js` stores every incrementable value as a base plus one subtotal
per writer, summed on read. Two operators both tapping **+1** produce **+2**.
Under a plain last-write-wins map they'd produce **+1** — a scoreboard quietly
lying on air, which is the worst failure this system has.

`test/convergence.test.js` pins this with three peers exchanging updates
out of order.

An earlier cut nested one `Y.Map` per counter, and the test found the bug:
concurrent promotion of a fresh path had two peers each _constructing_ a map at
the same key, so last-write-wins kept one object and discarded the other's
deltas. Concurrently created containers can't merge; concurrently set keys can.
Hence the flat layout.

### Timers are absolute

A timer stores `{ ts, duration }` where `ts` is a target epoch. Every peer derives
the countdown locally, so there is no tick to synchronise and no drift to correct.

---

## Staged delivery

### Stage 1 — Provider seam

Add a transport interface to the host with a no-op default, so single-user stays
byte-for-byte what it is today.

```js
createVelcroHost({
  name: STUDIO_ID,
  mutations,
  sync: { url: '...', room: '...', token: '...' }, // absent => offline, as now
})
```

The host already funnels every write through `apply()` inside one Yjs
transaction, so a provider attaches to the doc without touching mutations.

**Done when:** `sync: undefined` behaves identically to the MVP, and a provider
stub can be attached and detached mid-session without dropping subscriptions.

### Stage 2 — Relay

`packages/relay`: a Durable Object that authenticates, holds the document, and
rebroadcasts updates. Persists to Durable Object storage so a late-joining
operator, or a reloading host, gets current state without the other side being
online.

**Done when:** two browser profiles on one machine converge through a locally
running relay, and the smoke test's assertions hold across both.

### Stage 3 — Status and presence

Wire Yjs awareness into the existing status channel (`velcro:<id>:#status`, which
already exists and is currently only used for `ready`).

Surface two things, because with _hired_ operators they aren't cosmetic:

- **Connection state** on the control surface — connected, reconnecting, offline
  and local-only. An operator must never be unsure whether their edits are landing.
- **Field-level presence** — who is editing what. Two operators fighting over one
  player-name field is the most likely day-one annoyance, and `Field` is already
  uncontrolled-while-focused, which is exactly the behaviour presence needs.

**Done when:** an operator's board visibly shows the host going offline and
recovering, without a reload.

### Stage 4 — Access control

Rooms are `roomId` plus **per-operator tokens**, not one shared secret. Operators
are hired; someone leaving must mean revoking a token, not rotating the room and
re-onboarding everyone.

- Relay validates the token and its scope on connect.
- Encrypt the document payload so the relay operator can't read a show.
- Ship a revocation path from the control surface — kicking someone must not
  require a redeploy.

**Done when:** a revoked token cannot reconnect and cannot decrypt subsequent
updates.

### Stage 5 — Clock skew

Timers compare `ts` against local `Date.now()`, and two machines routinely differ
by seconds. Negotiate an offset per peer against the host's clock on connect and
apply it in `useTimer`. Small change, but a visibly wrong countdown on a remote
operator's board undermines trust in everything else on screen.

**Done when:** a peer with a deliberately skewed clock displays the same
countdown as the host, within a second.

---

## Ingress ownership

"No remote commands" removes command routing, but not _ownership_.

A service like Google Sheets polls and writes into the store. If five operators
each run it, that's five times the API quota and five writers racing on the same
paths. Rocket League telemetry only exists on the gaming machine at all.

So every service declares an owner. `Service` already carries this:

```js
new SheetsService({ mutate, owner: false }) // consumes the replicated result
```

Non-owners stay in `delegated` status and never open a connection. Ownership is
explicit configuration, not an election — the host machine is known in advance,
and an election would be complexity bought for nothing.

## Why there are no commands yet

A CRDT replicates _state_. "Cut to replay" is a _command_: it has to execute
exactly once, on exactly one machine, and it isn't idempotent.

Model it as state and every reconnect or document replay risks re-firing it. Doing
it correctly needs an append-only intent log with per-entry IDs, acknowledgements,
and a single elected executor per capability.

Keeping OBS control local-only means none of that has to exist. When remote OBS
control does arrive, it arrives as an **intent log beside the state document** —
never as more state. That distinction is why the boundary is worth holding even
though relaxing it looks easy.

## Explicitly out of scope

- **Remote OBS control.** Above.
- **Peer-to-peer transport.** WebRTC's main-thread restriction makes it strictly
  worse here.
- **Operator-authored layout.** Needs a serializable studio document; deferred
  with drag-and-drop. Layout stays code so this stays honest.
- **Multi-OBS topologies.** One OBS, _n_ operators. Several hosts means several
  writers of scene-ish state and a genuinely different problem.

## Risks worth naming

| Risk                                                   | Handling                                                                                                                                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote operators on non-Chromium browsers              | Not a real constraint: module `SharedWorker` is Chrome 83+, Firefox 114+, Safari 16+. Ship a minimum-version note rather than a fallback. See [getting-started](./getting-started.md#browser-requirements). |
| Relay is a single point of failure for _collaboration_ | Accepted. It is never a single point of failure for the _broadcast_ — that's what local-first buys.                                                                                                         |
| Counter delta growth                                   | Bounded by distinct clientIDs that have ever incremented a path. A long-lived doc across many sessions accumulates keys; add compaction on load if it ever shows up in practice.                            |
| Two operators editing one text field                   | Presence (stage 3). Character-level merging is available if needed, but a field is not a document and last-write-wins is usually what an operator expects.                                                  |
