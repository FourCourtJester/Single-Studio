# Working in this repository

For anyone — person or agent — making a change here. The rest of the documentation
explains what this framework is and why it is shaped as it is; this explains how to
run it, and where the floor is thin.

## The gate

Run all of these before saying a change is done. They are quick except the last.

```bash
pnpm test              # every package. Builds core first -- see "src and dist"
pnpm lint
pnpm typecheck
pnpm verify:template   # packs the packages and builds the starter template against them
pnpm docs:build        # regenerates api.md from JSDoc, then builds the site
```

End-to-end is separate because it needs a server and a browser:

```bash
pnpm fixture:build
pnpm fixture:preview &                                    # serves on :4173
CHROMIUM_PATH=/path/to/chromium pnpm e2e                  # or omit if Playwright's own is installed
```

`pnpm e2e` does **not** start the preview server and does not build. A run against a
stale `dist` is a run that proves nothing, so build first, every time.

## `src` and `dist`, which is the trap worth knowing first

Packages import `@single-studio/core` through its **built** entry points. A change to
`packages/core/src` is invisible to every other package until core is rebuilt.

- `pnpm test` and `pnpm typecheck` build core first, so they are safe.
- `npx vitest run` inside a package — the obvious thing to do while iterating on one
  — is **not**, for anything but core itself.

The plugin packages carry a `vitest.config.js` that aliases core's source, so they
are safe either way. Nothing else is. If a test result surprises you, rebuild before
believing it: `pnpm --filter @single-studio/core build`.

This is not hypothetical. A change to a core service once passed a plugin's whole
suite because the suite was running against the previous build, and the only reason
it was caught is that a test which should have failed did not.

## The one convention this repository actually enforces

**Negative-test every check you add.** Break the code it is meant to catch, watch
that check go red, and put the code back. A check that cannot fail is worse than no
check, because it reads like coverage.

This is not a style preference. It has caught, in order: two guards that asserted on
a status which hid the fault they were guarding; an assertion that was true by
construction; and a probe whose `str.replace` silently matched nothing, so the
"proof" proved that the edit had not happened. All of those looked fine.

While you are at it: assert on the thing that changes, not on a state that was
already true. `expect(status).toBe('idle')` passes on a service that never started.

## Reading the tests

Test names are sentences about behaviour, not about functions. When one fails, the
name is meant to tell you what the show does wrong, not which method threw. Write new
ones the same way — `'a folded row still says why it is not running'`, not
`'renders problem when collapsed'`.

## The end-to-end suite is one long script, and order matters

`apps/fixture/e2e/smoke.mjs` runs top to bottom against one browser context, and
state carries. That is deliberate — it is how a show actually behaves — and it has
two consequences:

- **A check that changes state can break a later one.** Adding images to the library
  shifts counts that tests further down assert on. Put anything that adds or removes
  state near the end, after the checks that count things.
- **Position affects more than assertions.** A second browser-source page left open
  during the asset-library section wedged the board's folder upload a hundred lines
  later, reproducibly. Unexplained; if a check fails somewhere unrelated to what you
  changed, try moving yours rather than assuming you found a product bug.

## Comments

Comments here say **why**, and specifically what would break if the code changed.
That is the repository's most valuable asset and the reason a change can be made
safely without reading everything. Match it: if you find yourself writing what the
code does, either delete the comment or work out what you actually know that the next
reader will not.

Where a decision was measured, keep the measurement. `554 of 800`, `379px in a 192px
box`, `12/12 against 0/12` — a number is the difference between a claim and a
finding, and it lets somebody check you.

## Committing

- Subject line says what changed, in the show's language.
- Body says what was wrong, why this is the fix, and what was measured.
- Say what you did **not** verify. A commit that claims a green gate it did not run
  is worse than one that admits the e2e was still running.
- Never put a model name or identifier in a commit, a comment, or anything else that
  lands in the repository.

## Layout

|                                                |                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/core`                                | The framework. Components, the Yjs host, services, toolkits.                              |
| `packages/plugin-*`                            | One per integration. Each is a socket or a poller plus an event table.                    |
| `packages/provider-supabase`, `packages/relay` | The two ways a show collaborates.                                                         |
| `apps/fixture`                                 | The test rig. Every component, driven by the end-to-end suite. Not an example.            |
| `templates/studio`                             | What a new studio is scaffolded from. Mirrored to its own repository on release.          |
| `docs/`                                        | The published site. `docs/api.md` is **generated** — edit the JSDoc instead.              |
| `docs/internal/`                               | Findings, decisions and open threads. Written to survive the conversation they came from. |
