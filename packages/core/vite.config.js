import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library build. Two entrypoints: the main-thread surface and the SharedWorker
// host. They are kept separate so a studio's worker bundle never pulls in React.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.js'),
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
  },
})
