# Single Studio

[![npm](https://img.shields.io/npm/v/@single-studio/core.svg)](https://www.npmjs.com/package/@single-studio/core)
[![licence](https://img.shields.io/npm/l/@single-studio/core.svg)](LICENSE)

**Broadcast graphics for OBS, as React components.** Scoreboards, lower thirds,
tickers and clocks, driven from an operator's board that runs inside OBS as a custom
browser dock.

No server. No backend. Nothing to deploy but static files — and the graphics keep
working when the network doesn't.

**[See a studio running →](https://fourcourtjester.github.io/Single-Studio-Demo/#/)**
&nbsp;·&nbsp; **[Documentation →](https://fourcourtjester.github.io/Single-Studio/)**

## Start

Press **[Use this template](https://github.com/FourCourtJester/Single-Studio-Template)**,
then:

```bash
npm install
npm run dev
```

The board opens at the printed URL. Its header menu lists every graphic's
browser-source URL with a copy button — that is what you paste into OBS.

## A studio in two files

Both halves name the same path. That is the whole model.

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

Press **+** on the board and the scoreboard changes. There is nothing to declare, no
store to configure, and no wiring between the two files.

## What you get

**It keeps working.** A studio is static files and its state lives on the machine
running it. A dropped connection mid-show costs you collaboration, not your
graphics.

**Scores that add up.** Two operators both pressing +1 make +2. The obvious
implementation makes +1 — a scoreboard quietly lying on air, with nothing to report
it.

**Clocks that agree.** Every machine shows the same number on the same countdown,
including the one whose system clock is four seconds out.

**Nothing flashes.** A graphic switched on mid-show paints its real values, not a
frame of placeholder text over the programme.

**Collaboration when you want it.** Off until somebody pastes a link. Then a
producer drives the scores from their own laptop, over a service you own,
end-to-end encrypted with a key that service never sees. Their entire setup is
pasting one link into an OBS dock.

## The pieces

|                                                                                                      |                                                                                          |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **[Template](https://github.com/FourCourtJester/Single-Studio-Template)**                            | Start here. A studio, wired up, ready to edit                                            |
| **[Demo](https://github.com/FourCourtJester/Single-Studio-Demo)**                                    | A full show to look at — [live](https://fourcourtjester.github.io/Single-Studio-Demo/#/) |
| [`@single-studio/core`](https://www.npmjs.com/package/@single-studio/core)                           | The framework                                                                            |
| [`@single-studio/provider-supabase`](https://www.npmjs.com/package/@single-studio/provider-supabase) | Multi-operator collaboration, over a project you own                                     |

## Documentation

**[fourcourtjester.github.io/Single-Studio](https://fourcourtjester.github.io/Single-Studio/)**

- [Getting started](docs/getting-started.md) — an empty folder to a studio in OBS
- [Component reference](docs/api.md) — every component, its props, and what reads it on air
- [Your own data](docs/data.md) — your own state changes, and pulling data in from a feed
- [Working with other people](docs/collaborating.md) — for whoever runs the show on the night

## Requirements

React 18+ and a Chromium-based browser at 114 or newer — which is what OBS embeds.

## Licence

MIT — see [LICENSE](LICENSE). Changes are in [CHANGELOG.md](CHANGELOG.md).
