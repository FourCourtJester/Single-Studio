import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// A studio deploys to GitHub Pages under its repo name, so assets have to be
// resolved relative to that subpath. `base: './'` keeps it portable -- the same
// build works at a repo subpath, at a custom domain, or opened from disk, which
// matters because OBS loads these URLs directly.
export default defineConfig({
  base: './',
  plugins: [react(), tailwind()],
  build: { target: 'es2022' },
  worker: { format: 'es' },
})
