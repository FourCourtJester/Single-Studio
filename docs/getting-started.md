# Getting started

## Run the demo

```bash
pnpm install
pnpm demo
```

Open the printed URL. That is the control surface; it lists every graphic's
browser-source URL with a copy button.

`pnpm demo` builds `@single-studio/core` first. The demo consumes the framework
through its published entrypoints rather than reaching into its source — which is
what keeps the package boundary honest — so the package has to exist before the
demo can resolve it, and `dist` is not committed.

| Command             | Does                                                    |
| ------------------- | ------------------------------------------------------- |
| `pnpm demo`         | Build core, then run the demo studio with HMR           |
| `pnpm demo:build`   | Build core, then build the demo for production          |
| `pnpm demo:preview` | Serve the built demo (this is what OBS should point at) |
| `pnpm core:watch`   | Rebuild core on change — run alongside `pnpm demo`      |
| `pnpm test`         | Unit tests                                              |
| `pnpm e2e`          | Browser smoke test against a running preview            |
| `pnpm e2e:browser`  | One-off: download Chromium for the smoke test           |

Editing the framework itself while the demo runs needs `pnpm core:watch` in a
second shell — Vite reloads the demo when core's `dist` changes, but nothing
rebuilds core on its own.

The browser suite wants two shells:

```bash
pnpm demo:build && pnpm demo:preview   # shell A
pnpm e2e                               # shell B
```

Chromium ships in the devcontainer image, so `pnpm e2e:browser` is only needed
outside it, or after a Playwright version bump. It never needs root: the system
libraries are installed at image build time and the browser directory belongs to
the container's `node` user.

## Wire a studio into OBS

1. **Control surface** — _Docks &rarr; Custom Browser Docks_, pointed at the app root
   (`.../#/`).

   Run it as a dock, not in a separate browser. The dock shares OBS's browser
   process with your sources, which is what lets them share one store with no
   network involved. A separate browser is a separate process with its own
   SharedWorker and its own IndexedDB.

2. **Each graphic** — one Browser source per URL from the control page. Set the
   resolution to your canvas (usually 1920x1080).

   _Shutdown source when not visible_ is safe to enable if you want the memory back.
   The graphic is rebuilt from scratch each time its scene returns, and nothing is
   painted until the store has answered — see [Loading and reload](#sources-that-unload-when-hidden).

## Start a new studio

Copy `templates/studio` into a fresh repo. Until `@single-studio/core` is published
you can consume it from a workspace checkout; after publishing, `pnpm install` is
enough.

```
src/
  config.js          STUDIO_ID -- shared by the worker and the studio definition
  studio.js          defineStudio(): name, worker, control, sources
  velcro.worker.js   createVelcroHost(): your mutations
  mutations.js       your own named mutations
  control/Control.jsx
  sources/*.jsx
```

### Add a graphic

1. `src/sources/MyGraphic.jsx`, default-exporting a component.
2. Register it in `studio.js` under `sources`.
3. It appears at `#/source/myGraphic` and on the control page's list.

### Add state

Nothing to declare. Write to any path and read it back:

```jsx
<Field name="home.name" label="Home" />        {/* writes variables.home.name */}
<Variable name="home.name" fallback="Home" />  {/* reads it */}
```

Namespaces (`variables`, `toggles`, `timers`) are convention, set per component
with the `namespace` prop.

### Use a counter

`Stepper` and the `increment`/`decrement` mutations store values so that
concurrent edits add up rather than overwrite each other. Use them for anything
numeric an operator adjusts — scores especially.

### Add a mutation

```js
// src/mutations.js
export const mutations = {
  'my:new-period'(ctx) {
    ctx.write([['variables.period', String(Number(ctx.read('variables.period') || 0) + 1)]])
    ctx.add('variables.home.fouls', 0)
  },
}
```

```jsx
const mutate = useVelcroMutate()
<button onClick={() => mutate('my:new-period')}>New period</button>
```

## Component reference

**Source** — what goes on air:

| Component  | Reads              | Notes                                                                               |
| ---------- | ------------------ | ----------------------------------------------------------------------------------- |
| `Scene`    | —                  | Root of a graphic. `vars` maps CSS custom properties to paths.                      |
| `Variable` | `variables.<name>` | Text. `fit` shrinks it to stay on one line.                                         |
| `Image`    | `variables.<name>` | A bundled path, URL, or `asset:` upload. Preloads before swapping; `refresh` polls. |
| `Toggle`   | `toggles.<name>`   | Shows or hides its children.                                                        |
| `Timer`    | `timers.<name>`    | Countdown. `onComplete` fires once it lands.                                        |
| `Clock`    | — (local)          | Wall clock. Never replicates.                                                       |
| `Ticker`   | `variables.<name>` | Crawl at a constant px/sec, swaps text between passes.                              |

**Control** — the operator's board:

| Component      | Writes             | Notes                                                           |
| -------------- | ------------------ | --------------------------------------------------------------- |
| `Field`        | `variables.<name>` | Text or `as="textarea"`. Staged until saved.                    |
| `ImagePicker`  | `variables.<name>` | Preview, key dropdown, and Browse. Writes `asset:<key>`.        |
| `AssetLibrary` | —                  | Manage images: add by URL or file, rename, delete.              |
| `Select`       | `variables.<name>` | `options` of strings or `{ value, label }`. Staged until saved. |
| `Stepper`      | `variables.<name>` | Numeric &minus;/+. Uses counters, so concurrent edits add up.   |
| `Cycle`        | `variables.<name>` | Steps through `choices`, wrapping to unset.                     |
| `ToggleButton` | `toggles.<name>`   | `group` gives radio-button behaviour.                           |
| `SwapButton`   | any paths          | Trades values pairwise, outermost first.                        |
| `ResetButton`  | any paths          | Unsets them. `confirm` asks first.                              |
| `TimerButton`  | `timers.<name>`    | Start/stop a duration (`'5:00'`).                               |
| `Countdown`    | `timers.<name>`    | Counts to a wall-clock time, not a duration.                    |
| `Leaderboard`  | `variables.<name>` | One delimited string; paste view and table view. Staged.        |
| `SaveButton`   | —                  | Commits every staged edit. Owns the Ctrl/Cmd+S binding.         |
| `Panel`        | —                  | Titled group. Children wrap in a flex row.                      |
| `Break`        | —                  | Forces a line break inside a `Panel`.                           |

## Images

Four ways in, all handled by the same component.

Templated from a value — "Boise State" resolves `logos/boise-state.svg`:

```jsx
<Image name="home.name" src="/logos/:value:.svg" slug fallback="/logos/placeholder.svg" />
```

The value _is_ the URL — paste a link into a `Field` and it is on air:

```jsx
<Image name="sponsor.url" fallback="/logos/placeholder.svg" />
```

Contents change behind a stable URL — a chart, a camera still:

```jsx
<Image name="chart.url" refresh={30} />
```

An operator's upload, stored locally and referenced by content hash:

```jsx
<Image name="guest.photo" />
```

paired with a picker on the board:

```jsx
<ImagePicker name="guest.photo" label="Headshot" />
```

`Image` does not care which of the four it is given. A bundled path, a URL, and an
`asset:` reference all follow the same code path.

What separates this from an `<img>` tag is what happens **between** images. A new
URL is loaded and decoded off-screen first, and only swapped in once it can paint.
The previous image stays up meanwhile. Setting `src` directly leaves a hole on air
for however long the network takes — fine in a web page, not over a live scene.

The rest is failure handling that a broadcast needs and a web page does not:

| Behaviour                                         | Why                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| Retries with backoff (`retries`, default 3)       | A blip mid-show should not cost the graphic for the night               |
| Falls back after retries are exhausted            | A missing image should read as "no image", not as a broken-image glyph  |
| A failed `refresh` keeps what is showing          | Never blank a working graphic because a poll failed                     |
| `referrerpolicy="no-referrer"`                    | Many hosts block hotlinking by `Referer`                                |
| Warns loudly on `http://` from an `https://` page | Mixed content is blocked silently and is the most common way this fails |

**Use `https://` URLs.** A studio deployed to GitHub Pages is served over https, so
an `http://` image is blocked as mixed content. The console says so explicitly.

### The image library

Framing and logos belong in the repo — they do not change between shows. A guest
headshot that lands five minutes before air does not: there is no time to patch a
repo, and it usually arrives as a file.

The library is where those live. Two ways in, and both produce a **named entry**:

- **Paste a URL** — the bytes stay wherever they are.
- **Drop or choose a file** — the bytes are stored locally, content-addressed.

A graphic then points at the key (`asset:ada-okafor`) rather than at a link or a
hash. That is the name an operator recognises under pressure, and it means
repointing a slot is a rename in the library rather than an edit everywhere it is
used.

```jsx
<AssetLibrary />                                 {/* the manager, as a panel */}
<ImagePicker name="guest.photo" label="Headshot" />  {/* choose, with Browse */}
<Image name="guest.photo" />                     {/* on air */}
```

`ImagePicker` gives a preview, a dropdown of the library's keys for a fast swap
between segments, and **Browse** to open the library as a modal for adding,
renaming and deleting. The same `AssetLibrary` component serves both.

Two properties worth knowing:

- **Adding and going to air are separate.** Bytes land in the library immediately,
  because a file arriving is not a broadcast change. The _selection_ is staged like
  any other field, so nothing appears until save — an operator can line up the next
  guest mid-segment and commit on the cut.
- **Bytes deduplicate, keys do not.** The same photo filed under two names stores
  its bytes once, and deleting one key leaves the other working.

Bytes live in their own IndexedDB database, never in the document. Putting a few
megabytes of JPEG in a store that is persisted whole and cloned to every tab on
every change would be expensive now and worse once it replicates.

**Uploads are per-machine.** A file does not reach a remote operator — that needs
blob transfer over the relay, which is [planned but not
built](./collaboration.md#operator-supplied-files). URL entries replicate fine,
since they are just strings. For a single-machine studio, which is what ships
today, both work completely.

### Driving anything else from a value

`Scene` maps CSS custom properties to paths, which covers everything the framework
does not have a component for — colours, offsets, widths, radii:

```jsx
<Scene vars={{ '--accent': 'variables.sponsor.color' }}>
  <div style={{ borderLeft: '6px solid var(--accent, #0ea5e9)' }} />
</Scene>
```

A path holding nothing is left unset rather than blanked, so the `var()` fallback
still applies.

## Sizing for the dock

An OBS dock is either a narrow column pinned down one side or most of a monitor, and
the same board has to work at both. `Panel` handles that by default: children grow to
fill the row, wrap when they cannot, and never push the panel wider than the dock.

```jsx
<Panel title="Teams">
  <Field name="home.name" label="Home" />
  <Stepper name="home.score" label="Home score" />
  <Break /> {/* force a row break */}
  <Leaderboard name="standings" /> {/* compound controls take a row */}
</Panel>
```

Retune where it wraps with `--ss-control-min` (default `12rem`), globally or per panel:

```css
.ss-control {
  --ss-control-min: 9rem;
} /* pack tighter */
.ss-panel:has(.ss-leaderboard) {
  --ss-control-min: 100%;
} /* one per row */
```

Two rules make this work and are worth knowing if you write your own layout:
`min-width: 0` is what lets a flex item shrink below its content at all, and
`max-width: 100%` is what stops a wide control from forcing a horizontal scrollbar
across the whole board. A control with a hard `min-w-*` will escape a narrow dock —
that is the one thing to avoid.

The smoke test asserts a 260px dock has no horizontal scroll and that no control
escapes it.

## Saving

Free-text controls stage their edits and commit on save. Typing does not reach air:
an operator revises mid-word, and every intermediate state of that would otherwise
be on screen.

| Action                  | Effect                    |
| ----------------------- | ------------------------- |
| **Ctrl/Cmd + S**        | Commit every staged edit  |
| **Enter** (in a field)  | Commit every staged edit  |
| **Escape** (in a field) | Abandon that field's edit |
| **Discard**             | Abandon all staged edits  |

Buttons — `Stepper`, `ToggleButton`, `SwapButton`, `ResetButton`, `TimerButton`,
`Cycle`, `Countdown` — act immediately. Each is a single deliberate press with no
half-finished state to protect.

A save is one mutation, so every staged path lands in a single transaction and the
whole board changes on air together.

`ControlPage` renders a `SaveButton` in its header automatically. To put one
somewhere else, or to read the pending count yourself:

```jsx
import { SaveButton, useDraft, useDraftCount } from '@single-studio/core'

const pending = useDraftCount()
const { save, revert } = useDraft()
```

## Browser requirements

A studio needs a `SharedWorker` that can load an ES module — `new SharedWorker(url, { type: 'module' })`:

| Browser       | Minimum |
| ------------- | ------- |
| Chrome / Edge | 83      |
| Firefox       | 114     |
| Safari        | 16      |

All three engines have supported this since mid-2023, so in practice any current
browser works. The OBS dock runs on CEF (Chromium), and remote operators on the
collaboration path can use whatever they already have.

A browser too old to understand the options object does not error — it treats the
second argument as the worker's _name_, loads the script as a classic worker, and
its `import` statements fail somewhere the page never sees. That would hand an
operator a board where every field looks fine and nothing ever updates.

So the framework checks before it starts the store, and replaces the board with a
message naming what is missing and the version needed. The check is behavioural,
not a user-agent sniff: it hands the constructor an options object whose `type` is
a getter and sees whether anything reads it. Override the screen with
`onUnsupported`, or call `getSupport()` yourself:

```jsx
import { getSupport } from '@single-studio/core'

const { ok, missing, persistent } = getSupport()
```

`persistent: false` (no IndexedDB — private windows, some locked-down profiles) is
_not_ a failure: the store falls back to memory, which still drives graphics
correctly for the length of a session. It just will not survive a reload.

## Styling

Tailwind v4. A studio's CSS entry needs three lines:

```css
@import 'tailwindcss';
@import '@single-studio/core/styles.css';
@source '../node_modules/@single-studio/core/dist';
```

That `@source` line is required. Tailwind scans your files for utility classes, and
the framework's components live in `node_modules` — without it their classes get
stripped from your build.

`@single-studio/core/styles.css` carries only behaviour-critical rules: transparent
backgrounds for sources, the `Transition` state classes and their timing, and the
ticker keyframes.

CSS owns the timing. `Transition` reads the duration back off computed style, so
there is no duration prop to keep in sync — retune it any of three ways:

```jsx
<Variable name="home.name" className="duration-500" />   {/* Tailwind utility */}
```

```css
.scoreboard .ss-transition {
  transition-duration: 700ms;
} /* your own rule */
.scoreboard {
  --ss-duration: 900ms;
} /* custom property */
```

All of the framework's rules live in `@layer components` so any of these win.
That is load-bearing rather than tidy: unlayered declarations beat layered ones, so
framework CSS outside a layer would silently outrank every Tailwind utility a studio
wrote, and `duration-500` would quietly resolve to the default.

**Reduced motion applies to your control surface, not to graphics.** On a browser
source, animation is broadcast content, and the preference being read belongs to the
operator's machine — nobody watching the stream has a say in it. Honouring it there
would let one person's OS setting strip the animation from everyone's screen.

## Deploy

```bash
pnpm build && pnpm deploy   # gh-pages -d dist
```

Asset paths are relative (`base: './'`), so a build works at a Pages repo subpath,
on a custom domain, or opened off disk — which matters because OBS loads these
URLs directly.

## Troubleshooting

**Graphics show fallbacks and never update.** The control surface and the source
must be in the same browser process, and `STUDIO_ID` in `config.js` must match what
`createVelcroHost` receives. A mismatch logs a warning in the console.

**State came back wrong after renaming the studio.** `STUDIO_ID` names the
IndexedDB database. Renaming it starts from a clean slate; the old data is still
under the old name.

**A source is blank in OBS but fine in a browser.** Confirm the browser source URL
includes the `#/source/...` fragment.

### Sources that unload when hidden

These are supported and tested. A graphic is
destroyed and rebuilt every time its scene returns, and nothing is painted until the
store has answered — no fallback flash, no empty panel, and the state comes back
every cycle. The one thing that has to hold is that the dock stays open, since it is
what keeps the SharedWorker (and therefore the store) alive while every source is
unloaded. If everything unloads at once the worker exits and the next source to load
rehydrates from IndexedDB, which is slower but not lossy.
