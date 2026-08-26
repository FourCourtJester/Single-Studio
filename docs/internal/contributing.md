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

| Command                | Does                                                       |
| ---------------------- | ---------------------------------------------------------- |
| `pnpm fixture`         | Build core, then run the fixture studio with HMR           |
| `pnpm fixture:build`   | Build core, then build the fixture for production          |
| `pnpm fixture:preview` | Serve the built fixture (this is what OBS should point at) |
| `pnpm core:watch`      | Rebuild core on change — run alongside `pnpm fixture`      |
| `pnpm e2e:browser`     | One-off: download Chromium for the smoke test              |

Editing the framework while the fixture runs needs `pnpm core:watch` in a second
shell — Vite reloads the fixture when core's `dist` changes, but nothing rebuilds
core on its own.

The browser suite wants two shells:

```bash
pnpm fixture:build && pnpm fixture:preview   # shell A
pnpm e2e                                     # shell B
```

Chromium ships in the devcontainer image, so `pnpm e2e:browser` is only needed
outside it, or after a Playwright version bump. It never needs root: the system
libraries are installed at image build time and the browser directory belongs to
the container's `node` user.

## The vite override

`package.json` pins `pnpm.overrides.vite` to `^6.4.3`. VitePress 1.6.4 asks for
`vite ^5.4.14`, and every 5.x — including the newest, 5.4.21 — carries four
advisories fixed only in 6.4.2 and 6.4.3. There is no patched 5.x to move to and no
newer stable VitePress, so the override is the only way to resolve them without
running a 2.0 alpha for the docs site.

All four are dev-server issues and none of them reach anything published:
`pnpm audit --prod` was clean before the override as well as after. It is worth
keeping anyway, because a repository that cries wolf on Dependabot is one where the
real alert gets skimmed past.

**Remove it when VitePress 2.0 ships**, which depends on vite 6 natively. Check with
`pnpm audit` after taking it out — if the count is still zero, the override has done
its job and is only in the way.

## Where a studio's storage lives

Three IndexedDB databases, and an export has to walk all of them:

| Database            | Holds                                               |
| ------------------- | --------------------------------------------------- |
| `<studio>`          | The document — every value the show is made of      |
| `<studio>:assets`   | The image library: entries, and the blobs they name |
| `<studio>:settings` | Preferences. Hotkeys today, whatever comes next     |

`localStorage` still holds the operator name, the relay config and the relay admin
secret. Those are genuinely per-machine — an identity and a credential, not
preferences — and carrying them to another computer is at best meaningless and at
worst wrong. **Anything that a person sets up once and would resent setting up again
belongs in `:settings`**, because that is the half of the split that travels.

There is no export yet. The store is shaped for one: `all()` and `replaceAll()` are
the two halves of it.

## Still to review

- **`docs/data.md`** — the hooks in it have not had an API review. Revisit the
  surface before it is treated as settled.

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
