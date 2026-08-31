# Changelog

Both packages share a version — `@single-studio/core` and
`@single-studio/provider-supabase` are two halves of one release.

## 0.4.0

### Breaking

- **`StudioApp` is now `Studio`.**

  ```js
  import { Studio } from '@single-studio/core'

  createRoot(document.getElementById('app')).render(<Studio studio={studio} />)
  ```

  The old name said what it was built out of rather than what it is. One import and
  one tag in `src/main.jsx`; nothing else changes.

  The starter template now asks for `^0.4.0` rather than `^0.3.0` — a template
  pinned to the old range would install a version without `Studio` in it.

### Changed

- **Fewer comments in the starter template.** A file whose first screen is
  commentary about problems the framework had is a file that reads as somebody
  else's notes rather than as your studio. What is left says what a file is for and
  whether you need to touch it.

- `index.html` says on line one that it is Vite's entry point and can be left alone.
  `main.jsx` says what it does. `index.css` links to Tailwind's own documentation,
  which is the thing an author who has not met Tailwind actually needs. `config.js`
  explains what `STUDIO_ID` names and why it sits in a file of its own.

## 0.3.6

### Fixed

- **"Connecting…" no longer means "forever".** A paused Supabase project left the
  status light pulsing hopefully with nothing anywhere saying why. The transport was
  not at fault — its client reports one failed attempt and then goes quiet while it
  backs off, so the last thing the seam was told really was "connecting". A
  `connecting` that has not become `connected` within fifteen seconds is now an
  error, keeping whatever reason the transport gave.

- **The reason is shown, in the dialog the light already opens.** It was being
  carried and never rendered. Clicking a status light that is worrying you now
  answers the question instead of showing a form.

- **There is a way back.** A project that was paused and has been turned back on
  needs no new credentials — only a reconnect, which nothing offered. The banner
  carries **Try again**, which re-attaches what is already configured without
  reloading the board.

- A studio's `connect` that reports its status by registering a listener could miss
  its own transport's first event and be assumed connected. The contract — report
  before you return — is now written where it is read, and the demo follows it.

### Changed

- **The header menu is a cog, and says "Settings".** Everything behind it configures
  the board; three lines promise navigation.

- **The save button glows while work is staged.** It already turned amber, which is
  enough if you are looking at it — an operator mid-show is looking at the preview.
  Slow and shallow on purpose, and it stays lit rather than breathing under
  `prefers-reduced-motion`.

- **"Move" is now "Save and reconnect"** ("Connect" on a board with no room yet).
  "Move" described what the button does only when the address changed.

- Smaller: a rule above the plugins footnote, and buttons that sit beside a
  paragraph are centred against it rather than pinned to its first line.

### Added

- `sync.detail` beside `sync.state`, and `retry()` from `useRelay`.

## 0.3.5

### Added

- **Plugins.** A studio can now bring in data from something the framework knows
  nothing about — a game, a spreadsheet, a broadcast tool — without that thing
  needing to know anything about the framework either.

  A plugin connects outward and **emits events**. It never writes to the document.
  The studio author writes the mutations, in a handler class of their own, which is
  what keeps a plugin installed from npm from having any authority over the show and
  keeps it from imposing a vocabulary — a studio whose graphics already read
  `home.score` goes on reading `home.score`.

  ```js
  // src/velcro.worker.js
  class MyShow extends RocketLeagueHandler {
    onScore({ blue, orange }) {
      this.mutate('set', { 'variables.home.score': blue, 'variables.away.score': orange })
    }
  }

  createVelcroHost({ name: STUDIO_ID, mutations, plugins: [rocketLeague(MyShow)] })
  ```

  Everything runs in the SharedWorker, which is the one thing a studio has exactly
  one of — so a feed is read once however many boards, previews and browser sources
  are open, and `mutate` is a direct call rather than a message.

  `definePlugin`, `PluginBase`, `PluginHandler`, `SocketService`, `PollingService`
  and `Emitter` are on `@single-studio/core/worker`.

- **A plugins panel, in the menu.** Per-machine settings for whatever a studio
  installed — the port a game listens on was chosen by whoever runs the game, on
  their own PC, and a studio author three time zones away cannot know it. Values are
  stored per studio in the settings database, so they travel with an export and
  are not replicated to anybody else.

  `Plugins` is exported as a panel as well, for a board that would rather have it
  inline than in the menu.

- **Setup instructions, written by whoever knows.** A plugin declares `summary`,
  `help` blocks and a sentence per field; the panel shows the summary always and the
  rest behind _"How do I set this up?"_. Help is structured blocks rather than
  markdown so it survives `postMessage` and renders as elements — a plugin can write
  dull text, never markup.

- **A reason when something is not connecting.** `Service` keeps its last failure on
  `problem`, and the panel shows it under the plugin's name. A red light saying "Not
  connecting" sends an operator to whoever built the studio; _"Could not reach
  rocket-league at ws://127.0.0.1:49122"_ sends them to the game.

### Changed

- **Plugins start concurrently.** They used to start one after another, and a
  plugin's start is a handshake with somebody else's software — so a socket to a
  machine that was switched off decided when every plugin after it was allowed to
  begin. One that fails still does not stop the others.

### Fixed

- The sealed-room tests waited a fixed 30ms for real AES-GCM to finish, which passed
  alone and failed under a full workspace run. They drain the work in flight instead.

## 0.3.0

### Added

- **The save shortcut is rebindable.** Ctrl/Cmd+S was hard-wired into `SaveButton`
  and was the only way to save from the keyboard. It is now a default rather than a
  rule: **menu → Keyboard shortcuts**, press the key you want.

  Discard can be bound too, and ships unbound — a destructive action that arrives
  already on a key is one somebody finds by accident.

  Bindings are the operator's rather than the show's — rebinding yours does not move
  anybody else's — but they are stored with the studio rather than on the machine,
  so they travel. A chord already in use is taken off whatever held it rather than
  firing both.

  The recorder reads the keys rather than asking you to spell them, and says when a
  choice has a catch: `Escape` and `Tab` are refused outright, a combination the
  browser handles above the page is flagged as one that will never fire, and a plain
  letter is noted as working only while no field has focus.

- **A settings store, in IndexedDB.** `<studio>:settings`, a third database
  alongside the document and the image library. What is kept here is carried by an
  export of a studio's storage; anything in `localStorage` would be left behind,
  which is what made it the wrong home for a preference somebody set up once.

  `SettingsStore` has `get`, `set`, `remove` and `clear`, plus `all` and
  `replaceAll` — the pair an export and an import want. One row per setting rather
  than one object holding them all, so two writers cannot erase each other.

- `Hotkeys` and `HotkeysDialog` components, `useHotkeys`, `useHotkeyHandlers` and
  `useSettingsStore` hooks, `currentBindings()` for code outside React, and a
  `hotkey` toolkit (`chordOf`, `formatChord`, `ariaChord`, `problemWith`) on
  `@single-studio/core`.

### Changed

- `SaveButton` reads the bound chord instead of owning `Ctrl+S`. Its tooltip and
  `aria-keyshortcuts` follow whatever the shortcut currently is.

- **Reset this machine** clears the settings database along with everything else.

## 0.2.0

The first release a studio can actually be built on. 0.1.x published the packages
but nothing depended on them yet, which is what made this round of renaming free.

### Breaking

- **Components moved to two entry points.** The root no longer exports them:

  ```js
  import { Field, Panel, Toggle } from '@single-studio/core/control'
  import { Scene, Toggle, Variable } from '@single-studio/core/source'
  ```

  Hooks, mutations and toolkits stay on `@single-studio/core`. Nothing needs both
  component sets in one file, which is what lets each side use the name that fits.

- **`ToggleButton` is now `Toggle`** — the control-surface one. The graphic that
  shows its children while a toggle is on is also `Toggle`, from `/source`.

- **`Field`'s `as` prop is gone**; several lines of text is `<TextArea>`. Enter
  inserts a line break there and still commits in a `Field`.

- **`swap` cuts the list in half** instead of trading outermost-inwards. Write one
  side, then the other, in the same order:

  ```jsx
  <SwapButton names={['home.name', 'home.score', 'away.name', 'away.score']} />
  ```

  An odd number of paths now throws rather than dropping the middle one.

- **`group` is a name, not a list.** Give the same one to every button that should
  be mutually exclusive; the group works out its own membership.

  ```jsx
  <Toggle name="stats" group="panels" />
  ```

- **`react-router-dom` peer is now `>=7.18`.** The 6.x line has no fix available for
  GHSA-jjmj-jmhj-qwj2.

- **`ResetButton confirm` arms instead of prompting.** It used `window.confirm`,
  which an OBS dock never draws and reports as "they said no" — so the guard meant
  to make a destructive button safer made it silently do nothing there.

### Added

- **Collections**, for a list several operators add to: `append`, `replace`, and
  `useVelcroList` / `ctx.list` for reading one back in order. One path per member,
  so concurrent adds both survive. See [docs/data.md](docs/data.md).
- **Array and object operations**: `push`, `pull`, `move`, `patch`.
- **`ctx.collect`, `ctx.list`, `ctx.run`**, and every built-in callable straight off
  the context — `ctx.append({ … })`.
- **`onReady({ mutate, owns, sync })`** in the worker, for data no operator types.
  `owns()` is false once another machine holds the OBS role, so five operators do
  not become five times the API quota.
- **`Timer` takes `limit`** — past it a count-up carries `data-over` and `ss-over`.
- **Tone presets** (`danger`, `warn`, `go`, `primary`, `quiet`), exported as `TONES`
  and restylable through `.ss-tone-*`.
- **`@single-studio/provider-supabase` ships types.** It previously shipped none.

### Changed

- **Writes that change nothing now cost nothing.** A value structurally equal to
  what is stored produces no update, no persistence write and no re-render, which
  is what makes polling a feed reasonable. Counters keep their old behaviour: an
  absolute write still clears the per-writer subtotals.
- **The template needs no particular package manager.** It installs with npm, pnpm
  or yarn; npm is the default because it comes with Node.
- Sources may be nested — `sources/lower-thirds/single.jsx` is `lower-thirds/single`
  — and `sourcesFrom(import.meta.glob(…))` registers them without a list to keep.

### Fixed

- Every advisory: `vitest`, `vite`, `esbuild` and `react-router` are on patched
  lines. `pnpm audit` reports nothing.
- Removing an operator in `RelayAdmin` used `window.confirm`, so on an OBS dock the
  one control whose job is revoking access quietly did not.

## 0.1.2

Packaging fixes. LICENSE was missing from both tarballs — pnpm copies the workspace
root's into every package and npm does not, and the publish had moved from one to
the other.

## 0.1.0

First publish.
