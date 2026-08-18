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

  /**
   * One Yjs, whatever route it arrives by.
   *
   * The framework imports it, and so does the sync provider. Two copies in one
   * worker means a document created by one is updated by the other: structs
   * integrate, every `instanceof` check fails against the wrong copy's classes,
   * and remote values land as deleted placeholders. Nothing throws, and only the
   * receiving side is wrong.
   */
  resolve: { dedupe: ['yjs'] },
})
