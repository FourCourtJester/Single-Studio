// Stop `npm install` before it damages anything.
//
// This is a pnpm workspace: the packages depend on each other through the
// `workspace:*` protocol, which npm does not implement, and the layout Vite
// resolves through is pnpm's symlink tree. `npm install` therefore cannot succeed
// here -- but it does not fail cleanly either. It gets far enough to start
// rearranging `node_modules` before giving up, and what it leaves behind looks like
// a broken build rather than a wrong package manager:
//
//   Error: The following dependencies are imported but could not be resolved:
//     yjs (imported by packages/core/dist/mutations-*.js)
//
// That is `packages/core/node_modules/yjs` -- a symlink pnpm made and npm removed.
// Framework code externalises `yjs` deliberately (two copies in one bundle silently
// corrupt replication), so the bare import is correct and the missing link is not.
//
// Deliberately not the `only-allow` package: a guard that runs on every install
// should not itself need a registry fetch, and this is ten lines.

const agent = process.env.npm_config_user_agent ?? ''
const using = agent.split(' ')[0]?.split('/')[0]

if (using && using !== 'pnpm') {
  console.error(`
  This repository uses pnpm, and "${using}" cannot install it.

    corepack enable && pnpm install

  If a run has already started, clear what it left behind first:

    rm -rf node_modules packages/*/node_modules apps/*/node_modules package-lock.json
    pnpm install
`)
  process.exit(1)
}
