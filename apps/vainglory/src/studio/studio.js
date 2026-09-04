import { defineStudio, sourcesFrom } from '@single-studio/core'

import { STUDIO_ID } from './config'

// Two graphics: the match bar that sits over the game, and the holding slide that
// runs between matches.
export const studio = defineStudio({
  name: 'Vainglory',
  id: STUDIO_ID,
  worker: () => new SharedWorker(new URL('./velcro.worker.js', import.meta.url), { type: 'module', name: `velcro-${STUDIO_ID}` }),
  control: () => import('../control/Control'),
  sources: sourcesFrom(import.meta.glob('../sources/**/*.jsx')),
})
