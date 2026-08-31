// WIRING — you should not need to change this.
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

  /**
   * One Yjs, whatever route it arrives by.
   *
   * Load-bearing the moment you add collaboration: the framework imports Yjs and
   * so does a sync provider. Two copies in one worker means a document created by
   * one is updated by the other -- structs integrate, every `instanceof` check
   * fails against the wrong copy's classes, and remote values land as deleted
   * placeholders. Nothing throws, the bytes on the wire are perfect, and only the
   * receiving side is wrong.
   */
  resolve: { dedupe: ['yjs'] },
})
