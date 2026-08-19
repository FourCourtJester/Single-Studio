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

Two rungs, because they suit different people, and the framework holds no keys for
either.

**Bring your own service** — `@single-studio/provider-supabase`. Supabase Realtime
broadcast works from the browser with a project's anon key, so there is nothing to
deploy: a free project, two copied values, done. This is the default recommendation
for someone who does not want to operate anything.

**Bring your own relay** — `packages/relay`, a Cloudflare Durable Object. One
command, nothing to keep running, and it holds the document so a late joiner is
served even when every other machine is off. For anyone who wants that guarantee,
or who would rather not depend on a third party at all.

Ruled out along the way: **Pusher** (client-to-client needs private channels, which
need an auth endpoint — a backend), and **Trystero** (genuinely zero setup, but
WebRTC cannot be created in a `SharedWorker`, and the whole store lives in one; it
would need a main-thread socket bridged into the worker plus a rule for which tab
owns it — worth revisiting, not the first rung).

The seam takes any of them. The endpoint is just an address.

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

### Stage 3 — Status and presence ✅

**Shipped.** Yjs awareness, carried on the status channel that already existed.

```jsx
<SyncStatus />   {/* ControlPage renders one in its header automatically */}
<Operator />     {/* who is at this board */}
```

| Hook                    | Gives you                                              |
| ----------------------- | ------------------------------------------------------ |
| `useSyncStatus()`       | `state`, `room`, `connected`, `degraded`, `configured` |
| `usePresence()`         | Everyone in the room, `self` flagged                   |
| `usePathPresence(path)` | Who else has that path open                            |
| `usePresent()`          | Say something about this board                         |

**A studio with no relay renders no indicator at all.** Collaboration being absent
is not a state to report — it is how a one-operator show works, and a permanent
"offline" badge on a board that was never meant to be online is noise that teaches
operators to ignore the one piece of interface they most need to trust.

Connection state is the important half. An operator working a show from another
building has to know, without asking, whether what they are typing is going
anywhere. Ambiguity is worse than being plainly disconnected: someone who knows
they are offline fixes it, and someone who does not spends a segment wondering why
nobody is reacting.

Field presence came almost free, and the staged-edit model is why: an edit is
already local until saved and a dirty field already wins over the store, so warning
two operators that they are in the same field costs one list of path names. It is a
**warning, not a lock** — two people in one field is a conversation to have, and a
lock is something that can strand a board when a laptop closes with a field open.

One entry per _machine_, not per tab: a dock and a dozen browser sources share a
worker, so they share one identity in the room. The operator's name lives in
localStorage rather than in the document, because it belongs to the machine and not
to the show.

**Done when:** an operator's board visibly shows the host going offline and
recovering, without a reload. ✅ — covered by `apps/demo/e2e/relay.mjs`, which
stops the relay mid-show and asserts the indicator changes and changes back.

### Stage 4 — Access control 🟡

**Tokens and revocation shipped. Payload encryption deliberately not — see below.**

Rooms are `roomId` plus **per-operator tokens**. A production loses people: someone
finishes a contract, someone is not on this show, someone's laptop goes missing an
hour before doors. With one shared secret the only answer is to rotate it and
re-tell everyone else, which is the sort of job that gets postponed until it is
never done.

```bash
pnpm relay -- --admin "$RELAY_ADMIN"   # without this the token API is off entirely
```

#### What an operator actually does

Paste a link into an OBS custom browser dock. That is the whole of it.

```
https://your-studio.github.io/?relay=wss://relay.example.com&room=friday&key=…#/
```

They never see the word "token" and never open a settings screen; OBS remembers a
dock's URL, so it is a once-ever step. The secret rides in the link the way it does
in every share link anyone has used.

**The relay address is runtime, not build time.** A studio deploys as static files,
so an address baked into a build is one that cannot be changed without a rebuild
and a redeploy — a poor thing to discover an hour before doors. The SharedWorker
cannot read the page's URL, but the page can, and hands it down. `useRelay` reads
it, remembers it locally, and reconnects on later visits; `<RelayConnect />` is
where whoever runs the show sets it once, since they are the one person with no
link to arrive on.

**Somebody still has to run a relay**, and no amount of design removes that. Two
browsers cannot sync directly: WebRTC is main-thread only, needs a signalling
server anyway, and needs TURN for a fifth to a fifth of real connections — which is
a relay by definition. What can be removed is the _maintenance_: a Durable Object
is one `wrangler deploy`, costs nothing at this scale, and the studio itself stays
static on Pages.

`<RelayAdmin />` puts invite and remove on the board — one click, mid-show, no
redeploy. The admin secret lives in localStorage on the machine running the show,
never in the build: an operator's token lets them edit a show, and this one lets
them decide who can, so they are different powers with different keys.

Decisions worth keeping:

- **A room nobody has issued a token for is open.** That is the development case and
  the single-operator case. Demanding a token before anyone has minted one means a
  relay that does nothing until you read the manual. One live token and the room is
  guarded.
- **A stored list, not signed tokens.** Signing needs no state and is the usual
  advice, but revoking a signed token needs a denylist — state again, only now with
  expiry windows during which a removed operator is still admitted. A list one
  person can read and delete from is simpler and more obviously correct at this
  scale.
- **Revocation hangs up immediately.** The moment this has to work is the moment
  somebody is removed _during_ a show; waiting for a reconnect means they keep
  editing until they happen to refresh.
- **A secret is shown once.** A relay that can recite every operator's credential is
  a relay worth stealing. Lost one? Issue another.
- **No admin secret means the API is off, not open.** An unguarded mint endpoint is
  a worse default than no endpoint.

#### Why encryption is not here

The original plan said "encrypt the document payload so the relay operator can't
read a show". Building it revealed a trade the plan had not accounted for, and it
is not ours to make quietly:

**Encryption and server-side persistence are mutually exclusive.** The relay holds
a replica so a late joiner gets the show without another peer being awake — that is
stage 2's late-joiner guarantee and the reason an operator can open their board
before the streamer has started OBS. A relay that cannot read updates cannot
maintain that replica; it becomes a dumb rebroadcaster, and a late joiner needs
somebody else already online to sync from.

There is a second cost: revoking a token stops somebody connecting, but it cannot
un-tell them a key they already have. Real revocation under encryption means
rekeying the room and redistributing to everyone who remains — which is exactly the
shared-secret rotation this stage exists to abolish.

The threat it defends against is also narrower than it first appears. The relay is
the user's own Cloudflare account. "The relay operator cannot read the show" is
worth having when the relay is shared or hosted by someone else, and worth much
less when the relay operator _is_ the streamer.

So: not built, and not because it is hard. It should be a deliberate choice with
its costs stated, and the person who runs the show should make it.

**Done when:** a revoked token cannot reconnect ✅ and is disconnected on the spot
✅. Encryption is deferred with the reasoning above.

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

### Replicate the index before the bytes ✅

**Shipped.** Without it the naive version has a silent on-air failure.

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

An entry lives at `assets.<key>`, one path each, and the store grew a way to watch
a whole namespace (`useVelcroCollection('assets')`). One path per member is the
only conflict-free shape: a single path holding the whole library would mean two
operators adding different images inside the replication window and one of them
silently losing theirs — the counter problem again, in a different costume.

A picker marks an entry it cannot render _(elsewhere)_, and the library greys the
tile. The bytes still do not move; what changed is that nobody is offered a choice
that would go out blank.

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
