import { defineStudio } from '@single-studio/core'

import { STUDIO_ID } from './config'

// Everything the framework needs to know about this studio, declared once.
//
// `sources` is written out by hand here, and deliberately so. The template globs
// the folder -- `sourcesFrom(import.meta.glob('./sources/**/*.jsx'))` -- which is
// what a studio should normally do, since adding a graphic is then adding a file.
// Keeping the map here means both paths stay covered by something: the explicit one
// through these end-to-end suites, and the globbed one through the chunk check in
// scripts/verify-template.mjs.
//
// It also lets a key demonstrate grouping without renaming the file behind it.
export const studio = defineStudio({
  name: 'Demo',
  id: STUDIO_ID,
  worker: () => new SharedWorker(new URL('./velcro.worker.js', import.meta.url), { type: 'module', name: 'velcro-demo' }),
  control: () => import('./control/Control'),
  sources: {
    match: () => import('./sources/Match'),
    scoreboard: () => import('./sources/Scoreboard'),
    'lower-third': () => import('./sources/LowerThird'),
    standings: () => import('./sources/Standings'),
    sponsor: () => import('./sources/Sponsor'),
    ticker: () => import('./sources/Ticker'),
    'lower-thirds/guest': () => import('./sources/Guest'),
    // Throws on render, on purpose. The end-to-end suite uses it to prove a crashed
    // graphic paints nothing on air and shows itself under `?debug`.
    broken: () => import('./sources/Broken'),
    spacing: () => import('./sources/Spacing'),
  },
})
