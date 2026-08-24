# Fixture studio

A real studio that exists to be tested. It consumes `@single-studio/core` from
outside, exactly the way somebody else's studio does, which is the only way to find
out whether the package boundary actually holds.

```bash
pnpm fixture         # builds core, then serves this
```

**This is not the demo.** The demo people look at lives at
[Single-Studio-Demo](https://github.com/FourCourtJester/Single-Studio-Demo) and is
maintained there. The two started identical and are expected to drift: that one is a
showcase, this one is a test rig, and neither has to answer to the other.

What it is for:

- **The end-to-end suites.** `e2e/smoke.mjs` and `e2e/relay.mjs` are the only tests
  that exercise the parts which exist only in a browser — SharedWorker startup,
  BroadcastChannel fan-out between tabs, IndexedDB persistence, transition timing,
  the clocks — and, in the relay case, two browser profiles converging through a
  running relay.
- **The consumer typecheck.** `pnpm typecheck` compiles this against core's shipped
  types, which is what catches a studio still passing a prop the framework removed.
- **Proving the boundary.** Every import here goes through `@single-studio/core`,
  so anything the framework fails to export is a red build rather than something a
  studio author discovers.

Because it is a test rig, it is allowed to use things a published studio cannot:
`e2e/relay.mjs` imports `packages/relay` directly, which is `private: true` and
never goes to npm.

## The show

Modelled on a squad-based RTS broadcast, because that show happens to use every
component at once: two drafts, a map, an army composition, and all three kinds of
clock running together.

| Route                                                                                                      | What it is                           |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `#/`                                                                                                       | The operator's board                 |
| `#/source/match`                                                                                           | The whole show in one browser source |
| `#/source/scoreboard`, `#/source/lower-third`, `#/source/standings`, `#/source/sponsor`, `#/source/ticker` | Single-purpose graphics              |
| `#/source/lower-thirds/guest`                                                                              | A nested key, grouped under a folder |

## The art is a placeholder

Every image under `public/factions`, `public/commanders`, `public/units` and
`public/maps` is generated — see `scripts/placeholders.mjs`. Nothing here is anyone's
intellectual property.

To change the names, edit `src/roster.js` and regenerate:

```bash
node apps/fixture/scripts/placeholders.mjs
```

The control writes a slug and the scene templates a file path off it
(`./units/:value:.svg`), so the roster is the only place the names live.

## Running the suites

```bash
pnpm fixture:build && pnpm fixture:preview   # in one shell
pnpm e2e                                     # in another
pnpm e2e:relay                               # needs no server of its own
```
