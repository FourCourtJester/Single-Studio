import { defineStudio } from '@single-studio/core'

import { STUDIO_ID } from './config'

// Everything the framework needs to know about this studio, declared once.
//
// `sources` is an explicit registry rather than a directory convention: each
// entry is a dynamic import, so sources code-split automatically and a typo
// fails loudly at the control page instead of at air time.
export const studio = defineStudio({
  name: 'Demo',
  id: STUDIO_ID,
  worker: () => new SharedWorker(new URL('./velcro.worker.js', import.meta.url), { type: 'module', name: 'velcro-demo' }),
  control: () => import('./control/Control'),
  sources: {
    scoreboard: () => import('./sources/Scoreboard'),
    lowerthird: () => import('./sources/LowerThird'),
    standings: () => import('./sources/Standings'),
    sponsor: () => import('./sources/Sponsor'),
    ticker: () => import('./sources/Ticker'),
  },
})
