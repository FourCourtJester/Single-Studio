import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library build. Four entrypoints: the shared main-thread surface, the two
// component sets, and the SharedWorker host.
//
// The worker is separate so a studio's worker bundle never pulls in React. The
// dashboard and the graphics are separate because they are separate worlds -- see
// src/control.js. Rollup hoists whatever they share into a common chunk, so a board
// that imports both still resolves one copy of every context and hook.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.js'),
        control: resolve(import.meta.dirname, 'src/control.js'),
        source: resolve(import.meta.dirname, 'src/source.js'),
        worker: resolve(import.meta.dirname, 'src/worker.js'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      /**
       * Never bundle a dependency that owns identity.
       *
       * React is here for the usual reason -- two Reacts means two hook
       * dispatchers. `yjs` is here for a sharper one, and it cost a day to find:
       * a studio's worker also loads yjs through its sync provider, so bundling a
       * copy here put *two* Yjs runtimes in one worker. A document created by one
       * and updated by the other integrates structs whose `instanceof` checks all
       * fail against the other copy's classes. Nothing throws. Updates arrive
       * byte-perfect, apply, and land as deleted placeholders -- the value on air
       * does not go stale, it goes missing, and only ever on the receiving side.
       *
       * Externalised, the consuming app resolves one copy for everything.
       */
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom', 'yjs', 'y-indexeddb'],
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    /**
     * One library rejection, and only that one.
     *
     * y-indexeddb chains a `.then` onto its own open without a catch, so a database
     * that refuses to open leaves an unhandled rejection nobody outside the library
     * can reach. The host settles regardless -- test/persistence.test.js is the
     * proof -- and in a browser this is a line of console noise. Vitest counts it as
     * a failed run, so the tests that simulate a refused open need it named here.
     * Matched on the simulated message *and* on lib0's open in the stack, so a
     * rejection from anywhere else still fails the run.
     */
    onUnhandledError(error) {
      const simulated = /Internal error opening backing store/.test(error?.message ?? '')
      const fromOpen = /lib0[\\/].*indexeddb\.js/.test(error?.stack ?? '')

      if (simulated && fromOpen) return false
    },
  },
})
