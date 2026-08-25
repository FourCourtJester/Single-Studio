# Working on the framework

For changing Single Studio itself. If you are building a studio _with_ it, start at
[getting started](../getting-started.md) — none of this is for you.

## Run it

```bash
pnpm install
pnpm fixture      # builds core, then serves the fixture studio
pnpm test
```

**pnpm, not npm**, and only here. The packages depend on each other through the
`workspace:*` protocol, which npm does not implement — a `preinstall` guard stops it
before it makes a mess. A studio built on the framework has no such constraint and
installs with whatever you like.

`pnpm fixture` builds `@single-studio/core` first, because the fixture consumes it as
a package rather than reaching into its source, and `dist` is not committed.

## Layout

| Path                         | What                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/core`              | `@single-studio/core` — the framework                                                             |
| `packages/provider-supabase` | Collaboration over a Supabase project. Nothing to deploy                                          |
| `packages/relay`             | Collaboration over your own relay. One `wrangler deploy`. Private — never published               |
| `templates/studio`           | The starter kit. Authoritative here; pushed to the template repository on release                 |
| `apps/fixture`               | A real studio used as the test rig — the browser suites and the consumer typecheck run against it |
| `docs/`                      | The documentation site, built with VitePress. `docs/internal/` is excluded from it                |

A studio is its own repository depending on `@single-studio/core`, with its own build
and its own Pages deployment. Framework upgrades are a version bump, not a merge.

## The checks, and what each is for

```bash
pnpm lint
pnpm test              # unit, across every package
pnpm typecheck         # the fixture, against core's shipped types
pnpm api:reference     # regenerate docs/api.md from those types
pnpm verify:template   # the publish rehearsal
pnpm e2e               # browser suite, needs a preview server
pnpm e2e:relay         # two profiles converging through a running relay
```

**`verify:template` is the one worth understanding.** It packs the packages the way
`npm publish` would, copies the template somewhere clean, points it at the tarballs
and builds it with no workspace to fall back on. That is the only check that can
catch a broken `files` or `exports` before npm does, and npm does not let you take a
version back.

The fixture cannot answer the same question: it resolves the framework through
`workspace:*`, which reaches the whole package directory regardless of what `files`
says.

**`typecheck` catches the drift nothing else sees.** A studio passing a prop the
framework removed still builds and still renders — React hands an unknown lowercase
attribute straight to the DOM without a word. Only a typechecker notices.

**`api:reference` is generated, so `docs/api.md` is not edited by hand.** CI fails if
it drifts from the shipped types. Change the JSDoc on the component instead.

## Roadmap

- **Now** — single operator, local-first, no external services.
- **Next** — service plugins (OBS, Google Sheets, BakkesMod) on the `Service` base.
- **Then** — [multi-operator collaboration](collaboration.md): one streamer plus _n_
  remote operators over a user-deployed relay, with the show still running if that
  relay goes down.
- **Later** — skinnable docks, then operator-authored layout.

## Also here

- [Architecture](architecture.md) — how the store, routes and components fit together
- [Collaboration plan](collaboration.md) — the design for going from one operator to several
- [Releasing](releasing.md) — publishing to npm, and the template sync
