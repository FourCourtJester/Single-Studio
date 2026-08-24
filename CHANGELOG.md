# Changelog

Both packages share a version — `@single-studio/core` and
`@single-studio/provider-supabase` are two halves of one release.

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
