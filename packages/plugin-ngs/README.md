# @single-studio/plugin-ngs

The [Nexus Gaming Series](https://nexusgamingseries.org) — the amateur Heroes of the
Storm league — for [Single Studio](https://fourcourtjester.github.io/Single-Studio/):
the season's teams, logos and rosters, its matches, and a chosen match with its
division's table. No key and no login; the league's site is public.

```bash
npm i @single-studio/plugin-ngs
```

## What it does, and when

Nothing on its own. Heroes has no live game feed, and the league does not know a
match's score until a captain reports it — usually after the broadcast — so there is
nothing worth asking for every thirty seconds. It fetches when the operator says:

| Press         | Asks the league for                                           | Your handler hears |
| ------------- | ------------------------------------------------------------- | ------------------ |
| Fetch season  | the season number, divisions, every team with logo and roster | `onSeason`         |
| Fetch matches | every match of the season, scheduled or not                   | `onMatches`        |
| Load match    | one match, fresh, with its division's table                   | `onMatch`          |
| Refresh match | the last loaded match again — for the result, once reported   | `onMatch`          |

The first two and the last are buttons on the plugin's panel in **Settings →
Plugins**. Loading a match needs a choice, so it is a board's job — see below.

## The handler

A plugin never writes to your show; your handler does, at your paths.

```js
// src/studio/velcro.worker.js
import { createVelcroHost, urlAssets } from '@single-studio/core/worker'
import { logos, ngs, ngsMutations, NgsHandler } from '@single-studio/plugin-ngs'

class Heroes extends NgsHandler {
  onSeason({ season, divisions, teams, maps }) {
    // Every logo into the image library, as `ngs/<team name>`, on every machine.
    this.mutate('set', urlAssets(logos(teams)))
    this.mutate('set', {
      'variables.ngs.season': season,
      'variables.ngs.divisions': divisions.map(({ key, name }) => ({ key, name })),
      'variables.ngs.maps': maps,
    })
  }

  onMatches({ matches }) {
    // What the board's pickers choose from. Only what a picker shows, and only
    // what is still to be played: a season is 321 matches.
    this.mutate('set', {
      'variables.ngs.matches': matches
        .filter((match) => !match.reported)
        .map(({ id, division, divisionName, round, start, home, away }) => ({
          id,
          division,
          label: `${divisionName} r${round}: ${home?.name ?? 'TBD'} vs ${away?.name ?? 'TBD'}`,
          start,
        })),
    })
  }

  onMatch({ match, standings }) {
    const { home, away } = match

    // One call, one transaction: the graphics never show a name without its logo.
    this.mutate('set', {
      'variables.home.name': home?.name ?? 'TBD',
      'variables.home.short': home?.ticker ?? '',
      'variables.home.logo': home?.logo ?? '',
      'variables.home.record': home?.record ? `${home.record.wins}–${home.record.losses}` : '',
      'variables.away.name': away?.name ?? 'TBD',
      'variables.away.short': away?.ticker ?? '',
      'variables.away.logo': away?.logo ?? '',
      'variables.away.record': away?.record ? `${away.record.wins}–${away.record.losses}` : '',
      'variables.match.bestOf': match.bestOf ?? 3,
      'variables.standings': (standings ?? []).map((row) => `${row.name}\t${row.wins}\t${row.losses}`).join('\n'),
    })

    // The league's score only once reported. Before that the operator is keeping
    // it, and a missing score must not overwrite theirs.
    if (match.reported) this.mutate('set', { 'variables.home.score': home?.score ?? 0, 'variables.away.score': away?.score ?? 0 })
  }
}

createVelcroHost({ name: STUDIO_ID, mutations: { ...mutations, ...ngsMutations }, plugins: [ngs(Heroes)] })
```

`ngsMutations` are three mutations that only ask the plugin — `ngs:season`,
`ngs:matches` and `ngs:load` — so a board can press the same buttons the panel has.

## The board: division, then match

The pickers are a choice the operator is making, not show state, so they live in the
component. Pressing **Load** asks the plugin; what comes back goes through your
`onMatch`.

```jsx
import { useState } from 'react'
import { useVelcroMutate, useVelcroValue } from '@single-studio/core'
import { Panel } from '@single-studio/core/control'

export function NgsPanel() {
  const mutate = useVelcroMutate()
  const divisions = useVelcroValue('variables.ngs.divisions', [])
  const matches = useVelcroValue('variables.ngs.matches', [])
  const [division, setDivision] = useState('')
  const [match, setMatch] = useState('')

  return (
    <Panel title="NGS" actions={<button onClick={() => mutate('ngs:matches')}>Fetch matches</button>}>
      <select value={division} onChange={(event) => (setDivision(event.target.value), setMatch(''))}>
        <option value="">Division</option>
        {divisions.map((d) => (
          <option key={d.key} value={d.key}>
            {d.name}
          </option>
        ))}
      </select>
      <select value={match} onChange={(event) => setMatch(event.target.value)} disabled={!division}>
        <option value="">Match</option>
        {matches
          .filter((m) => m.division === division)
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
      </select>
      <button disabled={!match} onClick={() => mutate('ngs:load', { id: match })}>
        Load
      </button>
    </Panel>
  )
}
```

## Logos

`logos(teams)` turns the season's teams into image-library entries named for each
team — `ngs/stormblessed` — and core's `urlAssets` writes them where the library
reads. They appear in every `ImagePicker`, under an `ngs` group, on every machine in
the room, and draw on every graphic: they are URL entries, so there are no bytes to
copy. A team without a logo is left out. `logos(teams, { group: 'teams' })` files them
elsewhere.

The logo on a match side is the same URL, so `<Image name="home.logo" />` draws it
directly.

## What each event carries

- **`onSeason`** — `season` (22), `start` and `end` (epoch ms), `divisions`
  (`{ key, name, order, teams }`, in the league's order), `teams`
  (`{ id, name, ticker, logo, division, captain, members }`), and `maps`, the
  twelve-map pool.
- **`onMatches`** — `season`, `division` (null for all), `matches`: soonest first,
  unscheduled last.
- **`onMatch`** — `match` and `standings`. Each match side is
  `{ id, name, ticker, logo, score, record }`, or null for a playoff slot still
  waiting on a team. `standings` is the division's table in the league's order, or
  null if the league would not give it.
- **`onProblem`** — `{ status, message }`, also shown on the plugin's panel.

Things that are easy to get wrong, all measured on the live league:

- **`score` is null until the match is reported**, not 0.
- **`wins` and `losses` in a record are maps**, not matches.
- **`bestOf` is null when the league does not say**, which it does not for most
  matches, including some playoff ones. The handler above falls back to 3; a playoff
  match is usually 5.
- **`start` is null for a match nobody has scheduled**, 43 of 321 in season 22.
- **A team is called `Pending`.** It is a real team.

## The map pool

The league's API does not serve it. `MAPS` is copied from the league's own
match-reporting page and changes with a release of this package.

## Licence

MIT.
