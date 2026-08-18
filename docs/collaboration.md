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

### Stage 1 — Provider seam ✅

**Shipped.** `velcro/sync.js`, wired into the host.

The studio supplies `connect`; core imports no transport at all. That keeps the
framework dependency-free and keeps a deployment static — the relay's URL is
runtime configuration, never baked into a build.

```js
createVelcroHost({
  name: STUDIO_ID,
  mutations,
  sync: {
    room: 'friday-show',
    url: 'wss://relay.example.com',
    token,
    connect: ({ doc, url, room, token, report }) => {
      const provider = new WebsocketProvider(url, room, doc, { params: { token } })

      provider.on('status', ({ status }) => report(status))

      return provider
    },
  },
})
```

Absent `sync`, nothing runs and nothing is announced — the offline studio does not
even post an "offline" status, because that would be traffic that never existed.

The seam needs no publishing code of its own. A provider applying a remote update
produces an ordinary Yjs transaction, and the host's existing observers turn that
into a publish. Attaching to the _document_ rather than to the mutation path is
what buys that.

Three things it guarantees, each pinned by a test:

- **Attach waits for persistence.** A provider syncing before IndexedDB has
  replayed either pushes a half-empty document at the room or has the replay land
  on top of remote state.
- **A failed connect is local-only, not fatal.** The host keeps rendering from its
  own doc. A relay that will not connect costs collaboration, never the broadcast.
- **Attach/detach is safe mid-show,** including mid-connect. Subscriptions are
  untouched, so an operator repointing at another room does not lose the graphics
  they are driving.

`sync:status` over the existing port answers a board that asks, which is the hook
stage 3 hangs the connection indicator on.

### Stage 2 — Relay ✅

**Shipped.** `packages/relay`, covered by 21 tests plus a browser acceptance test
that runs two separate browsers against a real relay: edits both ways, concurrent
increments adding up, the relay dying mid-show without the graphics blinking,
peers reconnecting on their own, and a late joiner being handed the show.

Three pieces:

| File                              | What                                                                        |
| --------------------------------- | --------------------------------------------------------------------------- |
| `src/room.js`                     | One room, one document, n peers. Transport-agnostic, and where the logic is |
| `src/node.js`                     | A relay for `node`. Development, self-hosting, and the test suite           |
| `src/worker.js` + `wrangler.toml` | The Cloudflare Durable Object: the recommended deploy                       |

The room is deliberately ignorant of transports. It is handed peers that can
`send(bytes)` and told when bytes arrive, which is what lets the same logic run
behind `ws`, behind a Durable Object, and behind a pair of fakes in a test — so
convergence, late joiners and presence cleanup are testable with no socket in
sight.

It speaks the standard y-websocket protocol rather than one of our own, which
keeps the promise made above: the endpoint is just a URL, and a studio can point at
y-websocket, Hocuspocus or y-sweet instead without changing a line.

#### Two bugs found on the way, both worth remembering

**A dropped opening frame is nearly silent.** `join` used to be async, so a
transport could not attach its message listener until after an await — and a
peer's opening `syncStep1` is already in flight by then. Losing it looks like
nothing: the peer still _receives_ broadcasts, so it appears connected. What it
never gets is the state it asked for. Then a `Y.Map` set arrives, which is a delete
of the old value plus an insert of the new one; the peer resolves the delete
because it holds the old value, and parks the insert because it depends on
operations it never received. The key does not go stale, it goes **missing**, on
air, permanently. `join` is synchronous now and queues anything early.

**An exception while publishing can corrupt the document.** The host's `flush()`
runs inside Yjs's `afterTransaction`, so anything thrown there escapes into Yjs's
own bookkeeping and can leave a transaction half applied — the same
delete-without-insert outcome. A channel that will not take a message is a local
problem with one subscriber; it must never become a corrupt document. Guarded.

#### The bug that made it look impossible

The acceptance test failed for a long time on one check: peer A sets a value, B
receives it, B replaces it — and A ends up with the key **absent**.

It was two copies of Yjs in one worker. The framework imports it; so does the sync
provider. Externalised now, and deduped in the studio's Vite config.

Worth writing down, because nothing about the symptom points at packaging:

- The bytes on the wire were **byte-for-byte identical** in both directions.
- Nothing threw — not in the worker, not in the page, not in the relay.
- The receiving document integrated the operation and ended with the **same state
  vector** as the sender. Both peers agreed on exactly which operations existed.
- They disagreed only on what those operations _were_: on the receiving side the
  remote insert was a garbage-collected placeholder, marked deleted, instead of an
  item holding a string.

A document created by one copy of Yjs and updated by another integrates structs
whose `instanceof` checks all fail against the other copy's classes. The value does
not go stale — it goes missing, only on the receiving side, silently.

Two rounds of tests missed it entirely. Unit tests import the source rather than
the build. Node integration tests resolve one copy of Yjs through node_modules, so
two velcro hosts converged there perfectly — which is exactly what made the relay
look guilty for so long. Only two _browser_ peers replicating through a real socket
reproduces it, and `packages/core/test/bundle.test.js` now fails the build outright
if Yjs ever gets bundled again.

**Done.**

### Stage 3 — Status and presence

Wire Yjs awareness into the existing status channel (`velcro:<id>:#status`, which
already exists and is currently only used for `ready`).

Surface two things, because with _hired_ operators they aren't cosmetic:

- **Connection state** on the control surface — connected, reconnecting, offline
  and local-only. An operator must never be unsure whether their edits are landing.
- **Field-level presence** — who is editing what. Two operators fighting over one
  player-name field is the most likely day-one annoyance. The staged-edit model
  already gives this most of its foundation: an edit is local until saved, and a
  dirty field's staged value wins over the store, so presence is a matter of
  broadcasting _which paths someone has staged_ rather than inventing a locking
  scheme.

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

## Operator-supplied files

Images arrive two ways and only one is solved. A **URL** is a reference: it costs a
string in the store, replicates for free, and every peer fetches it independently.
That is what ships today, and it covers the sponsor card, the guest headshot, the
externally generated chart.

A **file** an operator drops in is a different problem, because the bytes have to
get to every machine that renders it. Three places they could live:

| Where                                            | Verdict                                                                                                                                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In the Y.Doc as a data URI                       | No. The document is persisted whole and structured-cloned to every tab on every change; a few megabytes of image makes each of those expensive, and a CRDT keeps more history than you would like. |
| Uploaded to a third-party host, URL in the store | Works today with no code — it collapses to the URL case. The cost is an account and a dependency per user, which is a poor default for a public release.                                           |
| Content-addressed blob store beside the document | The right answer, and the most work.                                                                                                                                                               |

The third means: hash the bytes, keep them in their own IndexedDB store (not the
doc), put only the hash in the document, and have a peer that lacks a blob request
it over the relay. The document stays small and replicates as it does now; blobs
move out-of-band and only to peers that need them.

### Replicate the index before the bytes

There is a half-step worth taking first, because without it the naive version has
a silent on-air failure.

An operator drops in a headshot, picks it, saves. The reference `asset:players/ada`
replicates fine. The host has no bytes for that hash, `resolveAsset` returns null,
and **the graphic goes to air showing its fallback** — while the operator's own
screen shows the photo. The failure is invisible in exactly the direction that
matters.

So replicate the **asset index**, not the blobs. An entry's metadata — key, kind,
url, hash, size — is a few hundred bytes and belongs in the document. Then:

- URL entries work everywhere, unchanged.
- File entries appear in every operator's picker under the right name and group, so
  the host's library is browsable remotely.
- A peer that lacks the bytes _knows_ it lacks them, so the UI can say so instead of
  quietly rendering nothing.

That turns the limitation from a trap into a visible boundary, and the index is the
same structure the eventual blob transfer needs anyway.

This is deliberately deferred. It wants the relay to exist first, since blob
transfer is a second channel over the same connection, and until then a
single-machine studio can reference local files by path anyway.

The near-term half-step, if drag-and-drop is wanted before the relay: accept a
dropped file, store it in a local blob store keyed by hash, and hand the graphic an
object URL. Works perfectly on one machine, does not replicate, and the storage
shape is already the one the full version needs.

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
