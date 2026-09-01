import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// Relative asset paths, so one build works on GitHub Pages, on a custom domain, or
// opened straight off disk -- OBS loads these URLs directly.
export default defineConfig({
  base: './',
  plugins: [react(), tailwind()],
  build: { target: 'es2022' },
  worker: { format: 'es' },

  // One copy of Yjs, however it is imported. Collaboration breaks in confusing ways
  // with two.
  resolve: { dedupe: ['yjs'] },
})
