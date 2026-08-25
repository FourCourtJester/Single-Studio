# @single-studio/core

[![npm](https://img.shields.io/npm/v/@single-studio/core.svg)](https://www.npmjs.com/package/@single-studio/core)
[![licence](https://img.shields.io/npm/l/@single-studio/core.svg)](https://github.com/FourCourtJester/Single-Studio/blob/main/LICENSE)

**Broadcast graphics for OBS, as React components.** Scoreboards, lower thirds,
tickers and clocks, driven from an operator's board that runs inside OBS as a custom
browser dock.

No server, no backend, nothing to deploy but static files — and the graphics keep
working when the network does not.

**[See a studio running →](https://fourcourtjester.github.io/Single-Studio-Demo/#/)**
· [source](https://github.com/FourCourtJester/Single-Studio-Demo)

## Start here

Not with `npm install`. Start from the
**[template](https://github.com/FourCourtJester/Single-Studio-Template)** — press
**Use this template**, and you get this package already wired to a control surface, a
graphic, the SharedWorker and a GitHub Pages deploy. Those are the fiddly parts, and
they are not interesting to assemble twice.

```bash
npm install    # in your new studio
npm run dev
```

Adding it to an existing project instead:

```bash
npm install @single-studio/core react react-dom react-router-dom
```

## What you write

Two halves sharing one store, and an entry point each. A graphic imports from
`/source`, the operator's board from `/control`. Nothing needs both in one file,
which is what lets each side use the name that fits it.

```jsx
// src/sources/Scoreboard.jsx — one file per OBS browser source
import { Scene, Variable } from '@single-studio/core/source'

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
// src/control/Control.jsx — the operator's board, in an OBS dock
import { Field, Panel, Stepper } from '@single-studio/core/control'

export default function Control() {
  return (
    <Panel title="Scores">
      <Field name="home.name" label="Home" />
      <Stepper name="home.score" label="Home score" />
    </Panel>
  )
}
```

That is the whole model: **both halves name the same path**, and the framework keeps
them in step. There is nothing to declare, no store to configure, and no wiring
between the two files.

## Why it is built this way

**One store, in a `SharedWorker`.** The dock and every browser source share it,
persisted to IndexedDB and fanned out per path — so a lower third is never
re-rendered by a shot clock ticking.

**Nothing polls, nothing round-trips.** A graphic that has just been switched on
paints its real values rather than a flash of placeholder text, because the state was
already there.

**Numbers add up.** Scores are counters, not last-write-wins, so two operators both
pressing +1 make +2 rather than +1 — the failure that quietly puts a wrong number on
air.

**Clocks agree.** A countdown stores the instant it ends, not the seconds remaining,
so every machine derives the same number and nobody has to tick.

## Collaboration, if you want it

Off until somebody pastes a link. Add
[`@single-studio/provider-supabase`](https://www.npmjs.com/package/@single-studio/provider-supabase)
and other people can drive the show from their own machines, over a project **you**
own, end-to-end encrypted with a key that never reaches the service carrying it.

An operator's entire setup is pasting one link into an OBS dock.

## Documentation

- [Getting started](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/getting-started.md) — an empty folder to a studio in OBS
- [Component reference](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/api.md) — every component, its props, and what reads it on air
- [Your own data](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/data.md) — your own state changes, and pulling data in from a feed
- [Working with other people](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/collaborating.md) — for whoever runs the show on the night

## Requirements

|                   |                                                                 |
| ----------------- | --------------------------------------------------------------- |
| Peer dependencies | React 18+, React DOM 18+, React Router **7.18+**                |
| Browser           | Module `SharedWorker` — Chromium 114+, which is what OBS embeds |

## Licence

MIT © Shaun Delaney
