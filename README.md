# Single Studio

Local-first broadcast graphics for OBS. Build your scoreboards, lower thirds, and
tickers as React components, drive them from an operator's board running as an OBS
dock, and deploy the whole thing as static files.

No server. No backend. The graphics keep working when the network doesn't.

> **Status: rewrite in progress.** This is a ground-up rebuild. The previous
> create-react-app/Redux version is tagged [`v0-cra`](../../tree/v0-cra) and is what
> currently runs in production for existing clients.

## What it is

Two halves sharing one store:

- **A control surface** — text fields, steppers, toggles, timers — running as an OBS
  custom browser dock.
- **Graphics** — one browser source per graphic, updating live as the operator
  works.

State lives in a `SharedWorker` shared by the dock and every source, persisted to
IndexedDB, fanned out per-path so a lower third is never re-rendered by the shot
clock.

## Layout

| Path                         | What                                                                                                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`              | `@single-studio/core` — the framework                                                                                                                                                                                                                      |
| `packages/provider-supabase` | Collaboration over a Supabase project. Nothing to deploy                                                                                                                                                                                                   |
| `packages/relay`             | Collaboration over your own relay. One `wrangler deploy`                                                                                                                                                                                                   |
| `templates/studio`           | Starting point for a new studio. Built from packed tarballs in CI, so it cannot drift                                                                                                                                                                      |
| `apps/demo`                  | A working studio, and the integration test for the package boundary                                                                                                                                                                                        |
| `docs/`                      | [Architecture](docs/architecture.md) · [Getting started](docs/getting-started.md) · [Working with other people](docs/collaborating.md) · [Component reference](docs/api.md) · [Collaboration plan](docs/collaboration.md) · [Releasing](docs/releasing.md) |

A studio is its own repo that depends on `@single-studio/core`, with its own build
and its own Pages deployment. Framework upgrades are a version bump, not a merge.

`pnpm verify:template` is what keeps that promise honest: it packs the packages the
way `npm publish` would, copies the template somewhere clean, points it at the
tarballs and builds it with no workspace to fall back on. The demo cannot answer the
same question — it resolves the framework through `workspace:*`, which reaches the
whole package directory regardless of what `files` says.

## Quick start

```bash
pnpm install
pnpm demo      # builds core, then serves the demo studio
pnpm test
```

`pnpm demo` builds `@single-studio/core` first — the demo consumes it as a package
rather than reaching into its source, and `dist` is not committed.

See [getting-started.md](docs/getting-started.md) for wiring a studio into OBS and
starting your own.

## A studio in three files

```js
// src/velcro.worker.js -- owns the state, no React in this bundle
import { createVelcroHost } from '@single-studio/core/worker'
import { STUDIO_ID } from './config'
import { mutations } from './mutations'

createVelcroHost({ name: STUDIO_ID, mutations })
```

```js
// src/studio.js -- declared once, as data
export const studio = defineStudio({
  name: 'My Studio',
  id: STUDIO_ID,
  worker: () => new SharedWorker(new URL('./velcro.worker.js', import.meta.url), { type: 'module' }),
  control: () => import('./control/Control'),
  sources: { scoreboard: () => import('./sources/Scoreboard') },
})
```

```jsx
// src/sources/Scoreboard.jsx -- on air
<Scene>
  <Variable name="home.name" fallback="Home" fit />
  <Variable name="home.score" fallback="0" />
</Scene>
```

## Design notes

**Scores that add up.** Numeric values are stored as a base plus a per-writer
subtotal, so two operators both tapping +1 produce +2. A plain last-write-wins map
produces +1 — a scoreboard quietly lying on air.

**Timers that need no sync.** A countdown stores its target time, not its remaining
time, so every peer derives the same number with nothing to synchronise.

**Text that fits.** `Fit` binary-searches the largest font size that keeps a name on
one line. `Transition` defers content swaps until the exit animation finishes, so a
value change never shows the new value in the old one's outgoing animation.

**Extension by import.** A studio hands its own mutations to the host at startup.
Nothing is globbed, nothing is discovered by path convention.

## Roadmap

- **Now** — single operator, local-first, no external services.
- **Next** — service plugins (OBS, Google Sheets, BakkesMod) on the `Service` base.
- **Then** — [multi-operator collaboration](docs/collaboration.md): one streamer plus
  _n_ remote operators over a user-deployed relay, with the show still running if
  that relay goes down.
- **Later** — skinnable docks, then operator-authored layout.

## License

MIT — see [LICENSE](LICENSE).
