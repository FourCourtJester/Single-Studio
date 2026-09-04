import { Image, Scene, Variable } from '@single-studio/core/source'

import './Scoreboard.css'

/**
 * Add to OBS as a Browser source pointed at #/source/scoreboard
 *
 * Two plates, one per team, pushed to the outer edges of a box the width of
 * `--vg-width`. What is left between them is deliberately empty: the game draws
 * its own HUD across the middle of the top of the screen, and this leaves it the
 * room rather than trying to sit behind it.
 *
 * Every dimension is a custom property in Scoreboard.css. The gap in the middle is
 * not one of them -- it is whatever `--vg-width` has left after two `--vg-plate`s,
 * so widening the span or narrowing the plates opens it.
 *
 * Both team colours reach CSS as custom properties, so the accent stripes follow
 * the board without any component here knowing what a colour is.
 */
export default function Scoreboard() {
  return (
    <Scene className="vg flex flex-col items-center" vars={{ '--home': 'home.color', '--away': 'away.color' }}>
      <div className="vg-bar flex items-stretch justify-between">
        {/*
          The two sides mirror each other, scores innermost so the scoreline reads
          across the HUD rather than around it.

          Each name is a bounded flex item rather than one free to grow. `fit`
          measures the box it is given, and an unbounded box has room for anything
          -- so a long name overflowed its plate and was clipped by the scene
          instead of being scaled down. `min-w-0` is what lets a flex item be
          narrower than its own text.
        */}
        <div className="vg-plate flex items-stretch">
          <div className="flex min-w-0 grow items-center gap-5 pr-5 pl-8">
            <Variable name="home.name" fallback="Team A" transition="flip ease-sharp" fit className="vg-name min-w-0 flex-1 text-right" />
            <span className="vg-stripe" style={{ background: 'var(--home, #38bdf8)' }} />
          </div>
          <div className="vg-score">
            <Variable name="home.score" fallback="0" transition="slide-up ease-back" />
          </div>
        </div>

        <div className="vg-plate flex items-stretch">
          <div className="vg-score">
            <Variable name="away.score" fallback="0" transition="slide-up ease-back" />
          </div>
          <div className="flex min-w-0 grow items-center gap-5 pr-8 pl-5">
            <span className="vg-stripe" style={{ background: 'var(--away, #fb7185)' }} />
            <Variable name="away.name" fallback="Team B" transition="flip ease-sharp" fit className="vg-name min-w-0 flex-1 text-left" />
          </div>
        </div>
      </div>

      {/* Centred, which now puts it under the gap rather than under a plate.
          Nothing paints until an image is picked. */}
      <div className="vg-logo">
        <Image name="logo" alt="" />
      </div>
    </Scene>
  )
}
