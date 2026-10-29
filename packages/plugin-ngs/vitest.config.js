import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// Test against the core's *source*, not its build.
//
// `@single-studio/core/worker` resolves to `dist/worker.js` -- correct for anything
// installing this package, and a trap while developing the two together. Without
// these aliases a change to a core service is invisible here until somebody
// remembers to rebuild, so a plugin's tests pass against a core that no longer
// exists. That is not a hypothetical: it happened, the run was green, and the only
// reason it was caught is that a test which should have failed did not.
//
// The root `test` script builds core first and hides it. `npx vitest run` in this
// directory -- the obvious thing to do while working on one plugin -- does not.
const core = (entry) => fileURLToPath(new URL(`../core/src/${entry}.js`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: '@single-studio/core/testing', replacement: fileURLToPath(new URL('../core/src/testing/index.js', import.meta.url)) },
      { find: '@single-studio/core/worker', replacement: core('worker') },
      { find: '@single-studio/core/control', replacement: core('control') },
      { find: '@single-studio/core/source', replacement: core('source') },
      { find: /^@single-studio\/core$/, replacement: core('index') },
    ],
  },
  test: { environment: 'node', include: ['test/**/*.test.js'] },
})
