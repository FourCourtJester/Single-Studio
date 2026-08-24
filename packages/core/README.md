# @single-studio/core

Local-first broadcast graphics for OBS. Build scoreboards, lower thirds and tickers
as React components, drive them from an operator's board running as an OBS dock, and
deploy the whole thing as static files.

No server, no backend, and the graphics keep working when the network does not.

Part of [Single Studio](https://github.com/FourCourtJester/Single-Studio).

## Start a studio

Don't start here. Start from
[the template](https://github.com/FourCourtJester/Single-Studio/tree/main/templates/studio),
which is this package already wired to a control surface, a graphic, a SharedWorker
and a GitHub Pages deploy — the parts that are fiddly to assemble and boring to
assemble twice.

```bash
pnpm add @single-studio/core react react-dom react-router-dom
```

## What it is

Two halves sharing one store.

```jsx
// A graphic. One browser source per file.
import { Variable, Scene } from '@single-studio/core'

export default function Scoreboard() {
  return (
    <Scene>
      <Variable name="home.name" fallback="Home" />
      <Variable name="home.score" fallback="0" />
    </Scene>
  )
}
```

```jsx
// The operator's board, in an OBS custom browser dock.
import { Field, Panel, Stepper } from '@single-studio/core'

export default function Control() {
  return (
    <Panel title="Scores">
      <Field name="home.name" label="Home" />
      <Stepper name="home.score" label="Home score" />
    </Panel>
  )
}
```

State lives in a `SharedWorker` shared by the dock and every source, persisted to
IndexedDB, and fanned out per path — so a lower third is never re-rendered by the
shot clock. Nothing polls, nothing round-trips a server, and a graphic that has just
been shown paints its real values rather than a flash of placeholder text.

## Collaboration

Optional and off until somebody pastes a link. Add
[`@single-studio/provider-supabase`](https://www.npmjs.com/package/@single-studio/provider-supabase)
and other people can drive the show from their own machines, over a project you own,
end-to-end encrypted with a key that never reaches the service carrying it.

## Documentation

- [Getting started](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/getting-started.md) — how a studio is put together, from an empty folder to OBS
- [Component reference](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/api.md) — every component, its props and what reads them on air
- [Your own data](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/data.md) — writing your own state changes, and pulling data in from a feed
- [Collaborating](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/collaborating.md) — for the person running the show
- [Collaboration](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/collaboration.md) — how the replication, clocks and encryption actually work
- [Architecture](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/architecture.md) — why any of it is shaped this way

## Peer dependencies

React 18+, React DOM, and React Router 6.22+. Browsers need module SharedWorker
support — Chromium 114+, which is what OBS embeds.

## Licence

MIT
