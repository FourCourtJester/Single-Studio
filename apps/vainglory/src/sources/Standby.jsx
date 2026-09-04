import { Scene, Slideshow, Timer, Toggle, Variable } from '@single-studio/core/source'

import { SLIDE_PREFIX } from '../show'
import './Standby.css'

/**
 * How long each picture holds. One number, feeding both the component and the
 * drift in Standby.css, so the zoom and the change cannot fall out of step.
 */
const DWELL = 9

/**
 * Add to OBS as a Browser source pointed at #/source/standby
 *
 * The holding slide: artwork drifting behind a message and a clock to air. Only
 * the pictures are always on; the operator brings the card and the countdown in
 * and out independently.
 *
 * The pictures are whatever is in the image store under `slides/` — drop a folder
 * on the board and that is the show. Shuffled, so a long hold does not read as the
 * same handful of images going round.
 *
 * The drift is below rather than in the framework: `Slideshow` says which picture
 * is on and cross-fades between them, and what a slide *does* is a stylesheet's
 * business.
 */
export default function Standby() {
  return (
    <Scene className="vg-standby" style={{ '--standby-dwell': `${DWELL}s` }}>
      <Slideshow group={SLIDE_PREFIX} every={DWELL} order="shuffle" />

      {/* Over the artwork, under the text: what keeps white legible when a slide
          happens to be bright along the bottom edge. */}
      <div className="vg-scrim" />

      <div className="vg-stack">
        <Toggle name="standby.clock" transition="slide-up ease-out">
          <div className="vg-clock">
            <span className="vg-eyebrow">Live in</span>
            <Timer name="golive" fallback="--:--" className="vg-digits" />
          </div>
        </Toggle>

        <Toggle name="standby.card" transition="slide-up ease-out" style={{ '--ss-shift': '3rem' }}>
          <div className="vg-card">
            <Variable name="standby.message" fallback="Coming up next" />
          </div>
        </Toggle>
      </div>
    </Scene>
  )
}
