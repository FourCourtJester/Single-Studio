import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// `base: './'` keeps every asset path relative, so the same build works at a
// GitHub Pages repo subpath, on a custom domain, or opened straight off disk.
// OBS loads these URLs directly, so portability matters more than pretty paths.
export default defineConfig({
  base: './',
  plugins: [react(), tailwind()],
  build: { target: 'es2022' },
  worker: { format: 'es' },
})
