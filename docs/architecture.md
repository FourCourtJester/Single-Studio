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

Module SharedWorkers need Chrome 83+, Firefox 114+, Safari 16+, or OBS 28+ (OBS 27
and earlier embed CEF 75). A browser below that floor does not throw on
`{ type: 'module' }` — it reads the object as the worker's _name_ and loads the
script as a classic worker, so the store silently never starts.
`velcro/support.js` probes for this behaviourally (an options object whose `type`
is a getter, and whether anything reads it) and `StudioProvider` swaps in a screen
naming the missing capability. That check is why a companion operator on an old
browser gets an explanation rather than a board where nothing updates.

### Transport split

| Direction           | Mechanism                        | Why                                                                                                |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| client → host       | `MessagePort`                    | Per-client and ordered, and the host knows who sent what.                                          |
| host → one client   | `MessagePort`                    | The opening value for a subscription. Targeted and unmissable.                                     |
| host → every client | `BroadcastChannel`, one per path | Subsequent changes. A lower third bound to `variables.home.name` is never woken by the shot clock. |

The split between those last two matters more than it looks. A subscription's
opening value is a point-to-point handshake — exactly one client asked — and an
earlier cut sent it over the channel like any other change. That was wasteful
(every other tab woke for a value it already had) and, worse, unreliable:
delivery depended on the asking client's channel listener being attached at that
exact instant, and a reloading OBS browser source raced it. A missed opening value
has no recovery path, so the graphic sat on its fallback until something else
happened to change. It reproduced about half the time under load and vanished
whenever anything was attached that slowed the page down.

Sending it back down the port the request arrived on makes it ordered, targeted,
and impossible to miss.

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
`swap`, `timer`, `stopwatch`, `clear`.

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
rewrite rules. The cost is that every source shares one origin and one path, so OBS
— which names a browser source from its URL — sees them all as the same page.
`?layer-name=`, ahead of the hash where OBS looks, is what gives each one an
identity again. `SourceList` puts it on what it links and what it copies, and
leaves it off what it displays: the encoded parameter roughly doubles the length of
a line nobody reads off the screen.

## Components

Two families, one store.

**Source** (`Scene`, `Variable`, `Image`, `ImageList`, `Toggle`, `Timer`, `Clock`,
`Ticker`)
render on air. Each is a thin wrapper over `useVelcroValue`.

**Control** (`Field`, `Select`, `ImageSelect`, `ImagePicker`, `Stepper`, `Cycle`,
`ToggleButton`, `ImageToggle`, `SwapButton`, `ResetButton`, `TimerButton`,
`Countdown`, `Stopwatch`, `Leaderboard`, `Panel`, `Break`) drive
it. Styled with Tailwind, replacing Bootstrap and react-bootstrap.

`Transition` is the machine underneath every source component. It sets three phase
classes — `ss-exiting`, `ss-entering`, `ss-active` — and never touches a transform,
so what a phase _looks_ like belongs entirely to the stylesheet. That is why a
slide, a wipe or a bounce is a class name (`transition="slide-up ease-back"`) rather
than more code in the component, and why a studio can add its own variant without
the framework knowing. Duration is read back off computed style for the same reason:
CSS is the single source of truth, including for keyframe variants.

Three carry non-obvious decisions:

- **`Image`** templates its `src` with the value at a path (`logos/:value:.svg`),
  optionally slugified, so a team name resolves a badge with no lookup table. It
  transitions on _load_ rather than on the value changing, so a graphic never
  animates in around a half-fetched image, and a failed load falls back instead of
  showing a broken-image glyph on air.
- **The asset library** keys entries by path — `players/ada-okafor`. Grouping is
  the key's own shape rather than a second concept beside it, which is why re-filing
  an image is the rename that already existed and why nothing downstream had to
  learn about groups: a reference is still `asset:<one string>`. A folder add takes
  its prefix from the folder, so a hundred images arrive in one motion already
  organised. Batch adds read one file at a time against a single snapshot of the
  taken keys; the obvious `Promise.all(files.map(addFile))` reads every file into
  memory at once and re-reads the whole key list per file.
- **`Leaderboard`** stores the whole board as one delimited string in one path, not
  a path per cell. An operator pastes standings in from a spreadsheet, and one
  value keeps that a single atomic write instead of twenty racing ones — and lets
  the graphic render the board from one subscription.
- **`ResetButton`** uses `unset`, not empty strings. Removing the keys makes each
  source fall back to its own default; writing `''` would leave the paths present
  and holding blanks, which looks identical on the board and different on air.
- **`useTimer`** samples rather than schedules. Clocks store instants, so any read
  derives the right number — but the screen still has to repaint, and chasing the
  next whole second with `setTimeout` inherits every bit of that timer's lateness.
  Sampling four times a second and rendering only when the displayed second changes
  bounds how late a tick can be and costs nothing, since the comparison never
  reaches React. The distinction is invisible to any test that reads the clock's
  text: the value is correct either way, and only the spacing between repaints is
  wrong.

Two pieces carried over from the old build unchanged in spirit, because they were
the hard-won parts:

- **`Transition`** — a state machine (`active → exiting → entering → active`) that
  defers the content swap until the exit animation finishes, so a name change never
  shows the new name in the old one's outgoing animation. Duration is read from
  computed style, so CSS stays the single source of truth for timing.
- **`Fit`** — binary-searches the largest font size that keeps text on one line.
  The long-player-name problem: a lower third sized for "Kim" must also hold
  "Vandersteen-Rodriguez".
- **`Tooltip`** — replaces the `title` attribute on controls that need one. A
  native tooltip is drawn by the browser: it cannot be styled or aligned, it wraps
  where it likes, and it waits about a second to appear — a long time to hold a
  cursor still mid-show. Alignment is the part that matters most, since these sit on
  icon buttons pinned to an edge, where a centred bubble runs off the dock.
- **`Icon`** — the control surface's glyphs, drawn inline. Deliberately not a
  package: a font kit fetches from a CDN, which is dead weight in OBS and useless
  offline, and an icon library becomes a dependency every studio inherits whether or
  not it renders one. Swapping the set out later is a change to that one file.

### Text edits are staged, not live

Free-text controls (`Field`, `Select`, `Leaderboard`) do not write as you type.
They stage into a draft, and a save commits the lot — the Save button,
Ctrl/Cmd+S, or Enter. Escape abandons one field's edit.

This is a broadcast requirement, not a preference. Operators type at their own
pace and revise mid-word, and writing every keystroke through would put "Vand" on
the lower third while somebody was still thinking about "Vandersteen".

Committing together is also more correct than per-field writes. One save is one
`set`, therefore one Yjs transaction, so home and away names land on air in the
same frame rather than a few hundred milliseconds apart.

**Buttons stay immediate.** A stepper, toggle, swap, or reset is a single
deliberate act with no half-finished state to protect. The rule an operator
learns is "typing and picking need a save, buttons don't."

A dirty field shows an amber marker, because someone has to be able to tell at a
glance that what is on their screen is not what is on air. While a field is dirty
its staged value wins over the store, so a remote change can never yank text out
from under an operator mid-edit — which is also exactly what multi-operator
editing will need.

## Loading and reload

OBS browser sources can be set to unload when hidden, so a graphic is destroyed and
rebuilt every time its scene comes back. Two things have to hold on every cycle, and
both needed work:

**Nothing wrong is ever painted.** A subscription tracks `hydrated` separately from
"has a value", because "no value yet" and "no value" have to look different on air.
Source components render nothing until their path has loaded, then fade in; the
`fallback` prop is for a path that is loaded and genuinely empty. `SourcePage` also
holds the whole graphic until the store is reachable, because per-component gating
alone would still let a studio's static chrome — a scoreboard panel, a lower-third
plate — paint as an empty shell.

`Image` has two loads to line up and names them apart: `hydrated` is the store
saying what the value is, `painted` is the browser saying the file arrived. Neither
alone is enough.

**The state comes back.** Covered by the smoke test running four consecutive
unload/reload cycles, plus a recorder installed via `addInitScript` that captures
every frame the source ever displayed and asserts the fallback never appears among
them.

## Images

Images are a first-class input, not a special case. `Image` covers two shapes with
one component: a URL templated from a value (`/logos/:value:.svg`, optionally
slugified) and a value that _is_ the URL. The second is the default, so an operator
pasting a link needs no studio code.

The design decision worth naming is that a new URL is **loaded and decoded
off-screen before it is shown**, with the previous image left up in the meantime.
Setting `src` directly leaves a hole on air for the duration of the fetch. Around
that sits the failure handling a live scene needs and a web page does not: retries
with backoff, a fallback once they are exhausted, a `refresh` poll that keeps the
current image when a fetch fails, `no-referrer` to survive hotlink blocking, and an
explicit warning for `http://` on an `https://` page, which is otherwise blocked in
silence.

Beyond images, `Scene`'s `vars` maps CSS custom properties to paths. That is the
general form of the same idea: rather than growing a component for every property
an operator might want to control, anything a stylesheet can express becomes
drivable from the board.

### Where the bytes live

Images reach a studio two ways, and they want different homes.

**Shipped assets** — framing, logos, anything that does not change between shows —
belong in the repo. They are build-time inputs and need nothing from the store.

**Show-time images** cannot be. A podcast guest sends a headshot minutes before air:
too late to patch a repo, and it arrives as a file rather than a link. That is what
`AssetStore` is for.

The library holds **named entries**, and an entry is either a URL or stored bytes.
The document references the key — `asset:ada-okafor` — not a link or a hash. A key
is what an operator recognises mid-show, and it means repointing a slot is a rename
in one place rather than an edit to every path using it.

Two object stores, because identity and content are separate questions:

| Store     | Holds                                                                   |
| --------- | ----------------------------------------------------------------------- |
| `entries` | `key -> { kind, hash \| url, name, addedAt }` — what the operator named |
| `blobs`   | `hash -> { blob, type, size }` — the bytes, deduplicated by SHA-256     |

Splitting them means the same photo filed under two keys stores its bytes once, a
rename never touches the bytes, and deleting one key leaves another pointing at the
same file working. They are deliberately **not** in
the Y.Doc: that document is persisted whole and structured-cloned to every tab on
every change, so a few megabytes of JPEG would make each of those expensive, and a
CRDT retains more history than you want for a large value that gets replaced.

Content addressing costs nothing now and buys the property that matters later: when
blobs replicate over the relay, a peer can tell from a hash alone whether it already
holds the bytes.

IndexedDB is per-origin, so the dock writes and every browser source reads the same
database with no worker protocol between them.

`Image` treats all four inputs identically — bundled path, URL, `asset:` reference,
templated value. Asset resolution happens _in front of_ the existing preload
pipeline rather than beside it, so nothing downstream knows where the bytes came
from.

This is per-machine. Reaching a remote operator needs blob transfer over the relay,
described in [collaboration.md](./collaboration.md#operator-supplied-files); the
storage shape here is already the one that will need.

## Sizing

The control surface has two shapes to survive — a narrow OBS dock and a full screen
— so `Panel` owns the responsive behaviour rather than each studio reinventing it.
Children flex to `--ss-control-min` (12rem), wrap, and are clamped to the container
width. See `.ss-panel-body`.

`Ticker` measures its travel rather than expressing it in percentages. A percentage
transform resolves against the element's own width, so `translateX(100%)` on a short
message only moved it one text-width across — still inside the viewport — and the
distance travelled disagreed with the duration, so `speed` did not mean pixels per
second. The offsets now come from measurement and reach the keyframes as custom
properties, re-measured on resize.

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
