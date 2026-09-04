import { useEffect, useState } from 'react'

import { toAssetRef, useAssetLibrary } from '@single-studio/core'
import { Image, Scene, Timer, Toggle, Variable } from '@single-studio/core/source'

import { SLIDE_PREFIX } from '../show'
import './Standby.css'

/** How long each picture holds. The drift is paced off the same number. */
const DWELL_MS = 9000

/**
 * Add to OBS as a Browser source pointed at #/source/standby
 *
 * The holding slide: artwork drifting behind a message and a clock to air. Three
 * blocks, and only the pictures are always on -- the operator brings the card and
 * the countdown in and out independently.
 *
 * Every picture stays mounted and only its opacity moves, which is what makes a
 * change a cross-fade rather than a cut to black: the next image is decoded and
 * painted long before it is wanted. It also means the source can sit running for an
 * hour without touching the disk between slides.
 *
 * The pictures are whatever is in the image store under `slides/`. No picker, no
 * list to keep in step: drop a folder of screenshots on the board and they are the
 * show. See ../show.js.
 */
export default function Standby() {
  const { assets } = useAssetLibrary()
  const [at, setAt] = useState(0)

  // `here` matters on this page in particular. The store replicates what *exists*
  // to every machine but only the bytes on this one can be painted, and an entry
  // whose file is on the producer's laptop would go out as a blank slide.
  const slides = assets.filter((entry) => entry.here && entry.key.startsWith(SLIDE_PREFIX)).map((entry) => toAssetRef(entry.key))

  useEffect(() => {
    if (slides.length < 2) return undefined

    const tick = setInterval(() => setAt((index) => index + 1), DWELL_MS)

    return () => clearInterval(tick)
  }, [slides.length])

  // Read modulo rather than resetting the index: images added mid-show shorten or
  // lengthen the list, and a reset would cut to the first picture to say so.
  const showing = slides.length ? at % slides.length : 0

  return (
    <Scene className="vg-standby" style={{ '--standby-dwell': `${DWELL_MS}ms` }}>
      <div className="vg-slides">
        {slides.map((slide, index) => (
          <div key={slide} className="vg-slide" data-on={index === showing ? '' : undefined}>
            <Image value={slide} alt="" />
          </div>
        ))}
      </div>

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
