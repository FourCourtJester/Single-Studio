# Architecture

## The inversion

The old build kept every studio inside the framework at `src/studios/<code>/` and
found them with a webpack context require. That glob is why adding a studio meant
forking the framework and why every studio landed in every build.

Now the dependency runs the other way: **the framework is a package, a studio is an
app that consumes it.**

```
packages/core        @single-studio/core   the framework
templates/studio     what a new studio starts from
apps/demo            a real studio, and the integration test for the package boundary
packages/relay       (planned) collaboration relay, see collaboration.md
```

A client studio is its own repo with its own build and its own GitHub Pages
deployment. Framework upgrades are a version bump instead of a merge conflict.

`apps/demo` exists to consume `@single-studio/core` from outside and is the reason
the package boundary is honest — it has already caught one bug that only appears
across that boundary.

## Velcro

One `Y.Doc` per studio, owned by a `SharedWorker`, persisted to IndexedDB, fanned
out to every tab over BroadcastChannel.

```
   ┌── control dock ──┐   ┌── source ──┐   ┌── source ──┐
   │  useVelcroValue  │   │  Variable  │   │   Timer    │
   └────────┬─────────┘   └──────┬─────┘   └─────┬──────┘
            │  MessagePort       │ BroadcastChannel (one per path)
            ▼                    ▼               ▼
   ┌──────────────────────────────────────────────────────┐
   │  SharedWorker: Y.Doc + mutation registry             │
   │  y-indexeddb  ·  (later) sync provider               │
   └──────────────────────────────────────────────────────┘
```

### Why a SharedWorker

On the streamer's machine the control dock and every browser source live in the
same CEF process, so they share one store instance for free — no polling, no
server, no duplicated connections. It also puts the network boundary in the right
place for collaboration: one peer per _machine_, not per tab.

This depends on running the control surface as an **OBS custom browser dock**. A
control page in a separate browser is a separate process with a separate
SharedWorker and separate IndexedDB, and would need the sync layer to bridge them.

### Transport split

| Direction      | Mechanism                        | Why                                                                            |
| -------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| client → host  | `MessagePort`                    | Per-client and ordered, and the host knows who sent what.                      |
| host → clients | `BroadcastChannel`, one per path | A lower third bound to `variables.home.name` is never woken by the shot clock. |

The client refcounts subscriptions locally, so ten components reading one path
open one channel and one host subscription.

### Paths

Every value is addressed by a flat dot-path — `variables.home.score` — used as a
literal key in one `Y.Map`. Deliberately not a tree of nested maps: the whole
subscribe design is path-keyed, so a flat map turns "who cares about this change?"
into a `Set` lookup.

Conventional namespaces: `variables`, `toggles`, `timers`. Nothing enforces them.

Values that mean nothing (`undefined`, `null`, `false`, `''`) delete their key
instead of storing. `0` is a real value — a score of zero has to survive.

### Three maps

| Map        | Holds                                                |
| ---------- | ---------------------------------------------------- |
| `state`    | `path → JSON value`, last-write-wins                 |
| `counters` | `path → number`, a counter's absolute base           |
| `deltas`   | `<clientId>:<path> → number`, each writer's subtotal |

A path lives in `state` _or_ the counter pair. Counters win on read, and a path is
promoted the first time something increments it. See
[collaboration.md](./collaboration.md#counters-commute) for why.

### Mutations replace reducers

```js
export const mutations = {
  'my:reset'(ctx) {
    ctx.write([['variables.home.score', 0]])
  },
}
```

Same ergonomics as the old Redux reducers — a named function that takes a payload
and changes state — but operating on a Yjs transaction, so there is no store to
configure and no middleware chain. A studio's mutations join the built-ins in one
registry and dispatch identically. **A studio is not special; it is just more
mutations.**

Built-ins: `set`, `merge`, `unset`, `toggle`, `only`, `increment`, `decrement`,
`swap`, `timer`, `clear`.

Every mutation runs inside one `doc.transact()`, so observers see one atomic
change and a multi-path write never publishes a half-state.

### The plugin mechanism, concretely

The studio owns its worker entry:

```js
// src/velcro.worker.js
import { createVelcroHost } from '@single-studio/core/worker'
import { STUDIO_ID } from './config'
import { mutations } from './mutations'

createVelcroHost({ name: STUDIO_ID, mutations })
```

Nothing is discovered by path convention, nothing is globbed, and the worker
bundle contains no React. Extension is an explicit import.

`STUDIO_ID` is shared between the worker and `defineStudio` because it names the
IndexedDB database and every channel. When those drifted apart during
development, the app looked connected while talking to nobody — so the client now
adopts the id the **host** reports and warns on a mismatch.

## Routes

```
/                 control surface (the OBS dock)
/source/:name     one graphic (an OBS browser source)
```

The old `:code` segment is gone: a studio repo _is_ one studio, so identity is
build configuration rather than a URL parameter. Sources come from an explicit
registry, so the framework never dynamically imports a user-supplied path.

Hash routing, because it lets a static Pages deploy serve deep links with no
rewrite rules.

## Components

Two families, one store.

**Source** (`Scene`, `Variable`, `Toggle`, `Timer`, `Clock`, `Ticker`) render on
air. Each is a thin wrapper over `useVelcroValue`.

**Control** (`Field`, `Stepper`, `ToggleButton`, `Cycle`, `SwapButton`,
`TimerButton`, `Panel`) drive it. Styled with Tailwind, replacing Bootstrap and
react-bootstrap.

Two pieces carried over from the old build unchanged in spirit, because they were
the hard-won parts:

- **`Transition`** — a state machine (`active → exiting → entering → active`) that
  defers the content swap until the exit animation finishes, so a name change never
  shows the new name in the old one's outgoing animation. Duration is read from
  computed style, so CSS stays the single source of truth for timing.
- **`Fit`** — binary-searches the largest font size that keeps text on one line.
  The long-player-name problem: a lower third sized for "Kim" must also hold
  "Vandersteen-Rodriguez".

`Field` is uncontrolled while focused. A controlled input round-trips every
keystroke through the worker and fights the operator's cursor; instead the DOM owns
the value while focused and Velcro only writes over it when the change came from
elsewhere. That is also exactly what multi-operator editing needs.

## Services

None ship yet. The base class exists because the old OBS, Sheets, and Rocket
League workers each reimplemented the same singleton, channel wiring, and a flat
5s retry. `Service` adds the two things they lacked: exponential backoff, and an
`owner` flag so ingress has a single writer. See
[collaboration.md](./collaboration.md#ingress-ownership).

## Testing

| Layer       | Where                     | Covers                                                         |
| ----------- | ------------------------- | -------------------------------------------------------------- |
| Unit        | `packages/core/test`      | paths, counters, mutations, time, three-peer convergence       |
| Integration | `apps/demo/e2e/smoke.mjs` | SharedWorker startup, cross-tab fan-out, IndexedDB persistence |

The split is deliberate. The store is pure and testable in Node against a raw
`Y.Doc`. Everything that only exists in a browser needs a browser — and the wiring
bug that made the UI look connected while talking to nobody was invisible to unit
tests and obvious to the smoke test.
