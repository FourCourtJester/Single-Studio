import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// Its own app, its own port, so this can run beside the demo fixture without
// either one stealing the other's dev server.
export default defineConfig({
  base: './',
  server: { port: 5174 },
  plugins: [react(), tailwind()],
  build: { target: 'es2022' },
  worker: { format: 'es' },

  // One copy of Yjs, however it is imported. Collaboration breaks in confusing ways
  // with two.
  resolve: { dedupe: ['yjs'] },
})
