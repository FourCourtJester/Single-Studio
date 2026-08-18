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

   **Use Copy rather than retyping what is on screen.** What it puts on the
   clipboard carries an OBS parameter the displayed URL leaves off:

   ```
   http://localhost:4173/?layer-name=Demo%20scoreboard#/source/scoreboard
   ```

   `layer-name` is what OBS names the source from. Routing is hash-based, so every
   source on a studio shares one origin and one path — without the parameter OBS
   sees a dozen copies of the same page, which is how a scene ends up full of
   `localhost`, `localhost (2)`, `localhost (3)`. It sits ahead of the hash because
   that is where OBS looks, and it is plain text: edit it if you want the source
   called something else.

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

| Component   | Reads              | Notes                                                                               |
| ----------- | ------------------ | ----------------------------------------------------------------------------------- |
| `Scene`     | —                  | Root of a graphic. `vars` maps CSS custom properties to paths.                      |
| `Variable`  | `variables.<name>` | Text. `fit` shrinks it to stay on one line.                                         |
| `Image`     | `variables.<name>` | A bundled path, URL, or `asset:` upload. Preloads before swapping; `refresh` polls. |
| `Toggle`    | `toggles.<name>`   | Shows or hides its children.                                                        |
| `Timer`     | `timers.<name>`    | Any of the three clocks; reads the stored shape. `onComplete` fires once it lands.  |
| `ImageList` | `variables.<name>` | A row of images from a multi-valued path. Same loading rules as `Image`.            |
| `Clock`     | — (local)          | Wall clock. Never replicates.                                                       |
| `Ticker`    | `variables.<name>` | Crawl at a constant px/sec, swaps text between passes.                              |

Every one of these except `Clock` and `Ticker` takes a `transition` prop — see
[Transitions](#transitions).

**Control** — the operator's board:

| Component      | Writes             | Notes                                                            |
| -------------- | ------------------ | ---------------------------------------------------------------- |
| `Field`        | `variables.<name>` | Text or `as="textarea"`. Staged until saved.                     |
| `ImagePicker`  | `variables.<name>` | Preview, key dropdown, and a magnifier. Writes `asset:<key>`.    |
| `ImageSelect`  | `variables.<name>` | Pick by picture. `multiple` + `max` for a composition.           |
| `ImageToggle`  | `toggles.<name>`   | `ToggleButton` with a picture. `from` reads the face off a path. |
| `AssetLibrary` | —                  | Manage images: add by URL or file, rename, delete.               |
| `Select`       | `variables.<name>` | `options` of strings or `{ value, label }`. Staged until saved.  |
| `ColorPicker`  | `variables.<name>` | Swatch, hex field and optional `presets`. Staged until saved.    |
| `Stepper`      | `variables.<name>` | Numeric &minus;/+. Uses counters, so concurrent edits add up.    |
| `Cycle`        | `variables.<name>` | Steps through `choices`, wrapping to unset.                      |
| `ToggleButton` | `toggles.<name>`   | `group` gives radio-button behaviour.                            |
| `SwapButton`   | any paths          | Trades values pairwise, outermost first.                         |
| `ResetButton`  | any paths          | Unsets them. Reads "Reset `label`". `confirm` asks first.        |
| `TimerButton`  | `timers.<name>`    | Duration countdown. Typed unless `duration` presets it.          |
| `Countdown`    | `timers.<name>`    | Counts down to a wall-clock time, not a duration.                |
| `Stopwatch`    | `timers.<name>`    | Counts up. Start, pause, reset.                                  |
| `Leaderboard`  | `variables.<name>` | One delimited string; paste view and table view. Staged.         |
| `SaveButton`   | —                  | Commits every staged edit. Owns the Ctrl/Cmd+S binding.          |
| `Panel`        | —                  | Titled group. Children wrap in a flex row.                       |
| `Break`        | —                  | Forces a line break inside a `Panel`.                            |

## Clocks

Three of them, because a broadcast asks three different questions:

| Control       | Question                    | Stored as      |
| ------------- | --------------------------- | -------------- |
| `TimerButton` | "five more minutes"         | target instant |
| `Countdown`   | "we go live at 19:00"       | target instant |
| `Stopwatch`   | "how long have we been on?" | origin instant |

```jsx
<TimerButton name="round" label="Round" />                 {/* operator types it */}
<TimerButton name="break" label="break" duration="5:00" /> {/* a fixed preset */}
<Countdown name="showtime" label="Doors open" as="time" />
<Stopwatch name="match" label="Show elapsed" />
```

`TimerButton` grows an input unless you hand it a `duration`, because a fixed five
minutes is a guess about somebody else's show. The input takes whatever an operator
would naturally type — `90`, `1:30`, `1:02:03` — rather than insisting on a format.
Give it a `duration` when the length never varies and one press should start it.

All three land at `timers.<name>` and all three are read by the same source
component, which works out from the stored shape which kind it is:

```jsx
<Timer name="round" fallback="--:--" />
```

**Nothing ticks in the store.** A countdown stores the instant it ends and a
count-up stores the instant it began; every page derives the same number from the
same timestamp. That is why a second operator's clock agrees with the OBS machine's
without either of them sending the other a single frame, and why a graphic that OBS
destroys and rebuilds comes back showing the right time instead of restarting.

A pause stores the elapsed time it held, and resuming backdates the origin by that
much — so the clock picks up where it stopped without ever having counted anything
itself.

The screen still has to repaint, of course. The view samples each running clock four
times a second and re-renders only when the whole second it displays actually
changes. Sampling rather than scheduling is what keeps a tick landing on time:
`setTimeout` fires late under load, so a timer that chases the next second lands
wherever it lands, and the wander is visible on air even though every number it
shows is correct. Nothing about the sampling is written anywhere, so a throttled tab
renders late but never wrong.

Counting up floors and counting down rounds up, each so the number on screen matches
what an operator means by it: a countdown reads 00:01 until time is genuinely out,
and a stopwatch reads 00:00 until a second has genuinely passed.

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
- **Drop or choose files, or a whole folder** — the bytes are stored locally,
  content-addressed.

A graphic then points at the key (`asset:ada-okafor`) rather than at a link or a
hash. That is the name an operator recognises under pressure, and it means
repointing a slot is a rename in the library rather than an edit everywhere it is
used.

```jsx
<AssetLibrary />                                 {/* the manager, as a panel */}
<ImagePicker name="guest.photo" label="Headshot" />  {/* choose one */}
<Image name="guest.photo" />                     {/* on air */}
```

#### Groups

A key can be a path, and the slash is the whole organisation scheme:

```
players/ada-okafor
players/kim-nakamura
logos/acme
```

The part before the last slash becomes a group: an `<optgroup>` in every picker's
dropdown, and a heading in the library. A hundred images in one flat list is a
scroll an operator has to read; the same hundred under a handful of prefixes is a
menu they can aim at.

Groups are deliberately not a second concept with their own storage and their own
editing screen. The key already existed, renaming it already worked, and a graphic
still points at one string — so **re-filing an image is renaming it**, and nothing
downstream knows the difference.

Three ways to file something:

| You do this                          | You get                                       |
| ------------------------------------ | --------------------------------------------- |
| Type `players/ada` as the name       | That exact key                                |
| Type `players` and add several files | `players/<each filename>`                     |
| Drop or choose a folder              | `<folder>/<each filename>`, nesting preserved |

The name field means "name" for one file and "group" for several, which is the same
field meaning the same thing at two scales.

#### How many images can it hold?

There is no limit in the framework. The practical ones:

- **Browser quota.** IndexedDB gets a share of free disk — typically a large
  fraction of it in Chromium, so hundreds of megabytes of photos is not a problem.
  A show's worth of headshots is nowhere near it.
- **Duplicates are free.** Blobs are content-addressed by SHA-256, so the same
  photo filed under two keys stores its bytes once. Re-uploading a folder you
  already added costs nothing but entries.
- **Adds are sequential**, one file read at a time, so a folder of a hundred does
  not spike memory the way reading all hundred at once would. There is a progress
  readout above four files, and one unreadable file is reported rather than losing
  the rest of the batch.

Bytes never enter the Y.Doc — that document is persisted whole and cloned to every
tab on every change. The document holds `asset:<key>`; IndexedDB holds the image.

`ImagePicker` gives a preview, a dropdown of the library's keys for a fast swap
between segments, and a magnifier joined onto the dropdown that opens the library
as a modal for adding, renaming and deleting. The same `AssetLibrary` component
serves both.

### Picking by picture

When the choice _is_ a picture — a faction crest, a commander portrait, a map —
reading nine words is slower than recognising nine images, and a draft does not wait.
`ImageSelect` is `Select` laid out as a grid of tiles, and `ImageToggle` is
`ToggleButton` with a picture on it.

```jsx
<ImageSelect name="home.faction" label="Faction" options={FACTIONS} />
<ImageSelect name="home.army" label="Army" options={UNITS} multiple max={5} />
<ImageToggle name="sponsor" label="Sponsor" image="./logos/acme.svg" />
<ImageToggle name="sponsor" label="Sponsor" from="variables.sponsor.url" image="./logos/placeholder.svg" />
```

`ImageToggle`'s `from` points its face at a path rather than a fixed file, which is
what a switch for something the operator also _chooses_ wants: the sponsor toggle
should wear the sponsor they picked. `image` stays as the fallback for before
anything is chosen.

Each `ImageSelect` option is `{ value, label, image }`. The stored value is the plain one — a
source reading `variables.home.faction` cannot tell which control wrote it — so the
usual templating still applies:

```jsx
<Image name="home.faction" src="./factions/:value:.svg" />
<ImageList name="home.army" src="./units/:value:.svg" limit={5} />
```

`multiple` stores an array in the order the picks were made, which is what an army
composition or a ban list is, and `max` stops the grid rather than silently dropping
the overflow. `ImageList` puts that array on air, giving each entry the full `Image`
treatment.

These are buttons, so they act immediately. Pass `staged` to an `ImageSelect` that
should wait for a save with the text fields — a draft assembled off-air and revealed
on the cut.

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

On the board, `ColorPicker` is what fills that path. A swatch to pick from, a hex
field to paste a brand colour into, and an optional row of `presets` — because most
shows have four colours, and nobody should have to know that amber is `#f59e0b`:

```jsx
<ColorPicker name="sponsor.color" label="Accent" fallback="#f59e0b" presets={['#f59e0b', '#0ea5e9', '#e11d48']} />
```

Both halves write the same path and stay in step, and it stages like any other
field — typing `#f5` mid-hex would otherwise put a half-parsed colour on air.

## Transitions

Broadcast graphics do not snap between values; they animate out, swap, and animate
back in. Every source component does that already — the interesting part is _how_.

```jsx
<Toggle name="lowerthird" transition="slide-right ease-back opaque" />
<Variable name="home.name" transition="flip ease-sharp" />
<Image name="home.faction" transition="wipe" />
<Toggle name="showtime" transition="bounce" />
```

The prop is a space-separated list of variant names; each becomes an `ss-` class.
That is the whole mechanism. The state machine sets `ss-exiting` / `ss-entering` /
`ss-active` and **never touches a transform** — what a phase looks like is CSS, so
a variant costs a rule rather than a code path, and your own variant is just another
class you write and pass by name.

| Motion        | What it does                                               |
| ------------- | ---------------------------------------------------------- |
| `fade`        | The default. Opacity only.                                 |
| `slide-up`    | Arrives travelling upward (starts below its place)         |
| `slide-down`  | Arrives travelling downward                                |
| `slide-left`  | Arrives travelling leftward (starts to the right)          |
| `slide-right` | Arrives travelling rightward                               |
| `zoom`        | Scales up into place                                       |
| `flip`        | Rotates in about its top edge                              |
| `wipe`        | Reveals left to right, clipped rather than faded           |
| `bounce`      | Drops in and settles twice; dips and lifts out (keyframes) |

| Modifier      | What it does                                      |
| ------------- | ------------------------------------------------- |
| `opaque`      | Move without also fading — a pure slide           |
| `ease-out`    | Fast then settling. The safe default for a reveal |
| `ease-back`   | Overshoots and comes back. Reads as a bounce      |
| `ease-in`     | Slow then fast. For exits                         |
| `ease-sharp`  | Hard in, hard out. Mechanical, good for a wipe    |
| `ease-linear` | No easing                                         |

Two custom properties tune the rest:

```jsx
<Toggle name="sponsor" transition="slide-up ease-out opaque" style={{ '--ss-shift': '14rem', '--ss-duration': '480ms' }} />
```

- `--ss-shift` — how far a slide travels (default `1.5rem`)
- `--ss-duration` — how long a phase takes (default `300ms`); `--ss-drop` for `bounce`

**Use a length for `--ss-shift`, not a percentage.** A percentage transform resolves
against the element's own size, and a hidden `Toggle` has no content in it — so
`150%` of a collapsed box is zero and the graphic sits parked exactly where it will
land. It still animates correctly on the way in and out, when content _is_ present,
which is what makes the mistake so easy to miss.

Two more things worth knowing before you build a scene around this:

- **Pin blocks that reveal independently.** If two graphics share a flex row, one
  sliding in shoves the other sideways to make room. On air that reads as a bug
  rather than as a transition. The demo's `Match` scene positions each bottom block
  absolutely for exactly this reason.
- **Do not centre a transitioning element with a transform.** `-translate-x-1/2`
  and a variant that animates transform will fight, and the variant wins. Centre
  with a wrapper.
- **A keyframe variant needs keyframes in both directions.** An entrance animation
  ends with `both`, so the animation itself is holding the final transform; take it
  away on the way out and the element drops straight to the off-phase value with
  nothing to interpolate from. It teleports and then fades in place. `bounce` has an
  `ss-bounce-out` for this reason, and a custom keyframe variant needs one too.

Pick per element rather than per scene. In the demo's scoreboard a name flips over,
a score slides up and overshoots, and the badge plainly fades — because a logo
swapping with a flourish reads as a mistake.

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
| **Discard** (red ✕)     | Abandon all staged edits  |

Buttons — `Stepper`, `ToggleButton`, `ImageToggle`, `ImageSelect`, `SwapButton`,
`ResetButton`, `TimerButton`, `Countdown`, `Stopwatch`, `Cycle` — act immediately. Each is a single deliberate press with no
half-finished state to protect.

A save is one mutation, so every staged path lands in a single transaction and the
whole board changes on air together.

Save and Discard are icons — an amber floppy disk and a red ✕ — sized to match, and
Discard only appears when there is something to discard. There is no count of
pending changes: the dirty dot on each edited control says _which_, which is the
half worth knowing.

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
backgrounds for sources, the `Transition` state classes, their timing and motion
variants, and the ticker keyframes.

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
