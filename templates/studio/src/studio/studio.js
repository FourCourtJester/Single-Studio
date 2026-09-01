import { defineStudio, sourcesFrom } from '@single-studio/core'

import { STUDIO_ID } from './config'

// What this studio is called, and what it is made of.
//
// Every .jsx file in src/sources becomes a browser source. Add one and its URL
// appears in the board's Browser sources list, ready to paste into OBS.
//
// The name comes from the path: `Scoreboard.jsx` is `scoreboard`, `LowerThird.jsx`
// is `lower-third`, and a folder groups -- `sources/lower-thirds/Single.jsx` shows
// up as "Lower Thirds / Single".
//
// Only graphics belong in src/sources. Anything else in there turns up in the
// operator's list and in OBS; put shared pieces in src/components.
export const studio = defineStudio({
  name: 'My Studio',
  id: STUDIO_ID,
  worker: () => new SharedWorker(new URL('./velcro.worker.js', import.meta.url), { type: 'module', name: `velcro-${STUDIO_ID}` }),
  control: () => import('../control/Control'),
  sources: sourcesFrom(import.meta.glob('../sources/**/*.jsx')),
})
