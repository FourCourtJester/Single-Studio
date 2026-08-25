---
layout: home

hero:
  name: Single Studio
  text: Broadcast graphics for OBS
  tagline: Scoreboards, lower thirds and clocks as React components — driven from an operator's board inside OBS. No server, no backend, and the graphics keep working when the network does not.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: See it running
      link: https://fourcourtjester.github.io/Single-Studio-Demo/#/
    - theme: alt
      text: Use the template
      link: https://github.com/FourCourtJester/Single-Studio-Template

features:
  - title: Two components, one path
    details: A control writes variables.home.score and a graphic reads it. That pairing is the whole model — nothing to declare, no store to configure, and no wiring between the two files.
  - title: Nothing to deploy
    details: A studio is static files on GitHub Pages. The operator's board is a custom browser dock, each graphic is a browser source, and there is no backend to run or pay for.
  - title: Works when the network does not
    details: A studio is static files, and its state lives on the machine running it. A dropped connection mid-show costs you collaboration, not your graphics.
  - title: Numbers that add up
    details: Scores are counters rather than last-write-wins, so two operators both pressing +1 make +2. The alternative is a wrong number on air that nothing reports.
  - title: Clocks that agree
    details: A countdown stores the instant it ends, not the seconds left, so every machine derives the same number. Nobody ticks, and nobody drifts.
  - title: Collaboration when you want it
    details: Off until somebody pastes a link. Then a producer drives the scores from their own laptop, over a service you own, end-to-end encrypted with a key the service never sees.
---

## A studio in two files

Both halves name the same path. That is the entire mental model.

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

Press **+** on the board and the scoreboard changes. There is no step in between to
write.

## Start

```bash
# Press "Use this template" on the template repository, then:
npm install
npm run dev
```

The board opens at the printed URL. Its header menu lists every graphic's
browser-source URL with a copy button — that is what you paste into OBS.

[Getting started →](/getting-started) · [Components →](/api) ·
[Your own data →](/data)
