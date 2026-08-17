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
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom'],
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
})
