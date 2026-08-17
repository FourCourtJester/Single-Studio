import { defineStudio } from '@single-studio/core'

import { STUDIO_ID } from './config'

// Register every source explicitly. Each one becomes a browser source URL at
// #/source/<key>, and each import is code-split on its own.
export const studio = defineStudio({
  name: 'My Studio',
  id: STUDIO_ID,
  worker: () => new SharedWorker(new URL('./velcro.worker.js', import.meta.url), { type: 'module', name: `velcro-${STUDIO_ID}` }),
  control: () => import('./control/Control'),
  sources: {
    scoreboard: () => import('./sources/Scoreboard'),
  },
})
