# Getting started

## Run the demo

```bash
pnpm install
pnpm demo
```

Open the printed URL. That is the control surface; it lists every graphic's
browser-source URL with a copy button.

```bash
pnpm test                                   # unit tests
pnpm --filter @single-studio/demo build
pnpm --filter @single-studio/demo preview   # then, in another shell:
pnpm --filter @single-studio/demo e2e
```

## Wire a studio into OBS

1. **Control surface** — _Docks &rarr; Custom Browser Docks_, pointed at the app root
   (`.../#/`).

   Run it as a dock, not in a separate browser. The dock shares OBS's browser
   process with your sources, which is what lets them share one store with no
   network involved. A separate browser is a separate process with its own
   SharedWorker and its own IndexedDB.

2. **Each graphic** — one Browser source per URL from the control page. Set the
   resolution to your canvas (usually 1920x1080) and leave _Shutdown source when
   not visible_ unchecked so state stays warm.

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

| Component  | Reads              | Notes                                                  |
| ---------- | ------------------ | ------------------------------------------------------ |
| `Scene`    | —                  | Root of a graphic. One per browser source.             |
| `Variable` | `variables.<name>` | Text. `fit` shrinks it to stay on one line.            |
| `Image`    | `variables.<name>` | `src="logos/:value:.svg"`, plus `slug` and `fallback`. |
| `Toggle`   | `toggles.<name>`   | Shows or hides its children.                           |
| `Timer`    | `timers.<name>`    | Countdown. `onComplete` fires once it lands.           |
| `Clock`    | — (local)          | Wall clock. Never replicates.                          |
| `Ticker`   | `variables.<name>` | Crawl at a constant px/sec, swaps text between passes. |

**Control** — the operator's board:

| Component      | Writes             | Notes                                                           |
| -------------- | ------------------ | --------------------------------------------------------------- |
| `Field`        | `variables.<name>` | Text or `as="textarea"`. Staged until saved.                    |
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
ticker keyframes. Override the timing there and the transition machine follows it —
there is no duration prop to keep in sync.

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

**A source is blank in OBS but fine in a browser.** Check _Shutdown source when not
visible_, and confirm the browser source URL includes the `#/source/...` fragment.
