# Demo studio

A working studio, and the integration test for the package boundary — it consumes
`@single-studio/core` exactly the way yours will.

```bash
pnpm demo            # builds core, then serves this
```

## The show

It is modelled on a squad-based RTS broadcast, because that show happens to use
every component at once: two drafts, a map, an army composition, and all three
kinds of clock running together.

| Route                                                                                                                              | What it is                           |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `#/`                                                                                                                               | The operator's board                 |
| `#/source/match`                                                                                                                   | The whole show in one browser source |
| `#/source/scoreboard`, `#/source/lower-third`, `#/source/standings`, `#/source/sponsor`, `#/source/ticker`                          | Single-purpose graphics              |
| `#/source/lower-thirds/guest`                                                                                                      | A nested key, grouped under a folder |

`#/source/match` is the one to look at first. Everything inside it is switched on
and off from the board, which is how a small production actually runs: one browser
source in OBS, not fifteen.

## The art is a placeholder

Every image under `public/factions`, `public/commanders`, `public/units` and
`public/maps` is generated — see `scripts/placeholders.mjs`. Nothing here is anyone's
intellectual property, and all of it is meant to be overwritten.

To use your own, drop files with the same names into the same folders. To change the
names, edit `src/roster.js` and regenerate:

```bash
node apps/demo/scripts/placeholders.mjs
```

Nothing else changes. The control writes a slug and the scene templates a file path
off it (`./units/:value:.svg`), so the roster is the only place the names live.

## Tests

```bash
pnpm demo:build && pnpm demo:preview   # in one shell
pnpm e2e                               # in another
```

`e2e/smoke.mjs` drives the real browser: SharedWorker startup, BroadcastChannel
fan-out between tabs, IndexedDB persistence, transition timing, and the clocks.
