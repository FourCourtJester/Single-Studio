// YOURS — what this studio is called, and what it registers.
import { defineStudio, sourcesFrom } from '@single-studio/core'

import { STUDIO_ID } from './config'

// Every graphic in src/sources/ becomes a browser source. Add a file, and its URL
// appears in the control surface's Browser sources list, named and ready to paste
// into OBS -- there is no registry to keep in step.
//
// The key comes from the path: `Scoreboard.jsx` is `scoreboard`, `LowerThird.jsx` is
// `lower-third`, and a folder groups, so `sources/lower-thirds/Single.jsx` is
// `lower-thirds/single` and shows up in OBS as "Lower Thirds / Single".
//
// **src/sources/ is only for graphics.** Anything in there becomes a browser source,
// so a shared plate, a hook or a helper belongs somewhere else -- src/components/ is
// the obvious home. A file put there by mistake turns up in the operator's list and
// in OBS, which is a confusing way to find out.
//
// `import.meta.glob` is resolved by Vite at build time, not at runtime: it becomes a
// literal object of dynamic imports before any code runs, so every graphic is still
// code-split into its own chunk and nothing is loaded until it is opened.
//
// Prefer to name them yourself? Pass a plain object instead, and this file is the
// only place that changes:
//
//   sources: { scoreboard: () => import('./sources/Scoreboard') },

export const studio = defineStudio({
  name: 'My Studio',
  id: STUDIO_ID,
  worker: () => new SharedWorker(new URL('./velcro.worker.js', import.meta.url), { type: 'module', name: `velcro-${STUDIO_ID}` }),
  control: () => import('../control/Control'),
  sources: sourcesFrom(import.meta.glob('../sources/**/*.jsx')),
})
