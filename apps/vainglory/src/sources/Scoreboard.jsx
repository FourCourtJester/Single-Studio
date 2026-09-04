import { Image, Scene, Variable } from '@single-studio/core/source'

import './Scoreboard.css'

/**
 * Add to OBS as a Browser source pointed at #/source/scoreboard
 *
 * The match bar: team on the left, team on the right, the two scores either side of
 * centre, and the tournament mark centred underneath.
 *
 * How far down the whole thing sits is one number -- `--vg-top` in Scoreboard.css.
 * The game draws its own plate across the top of the screen and how much room that
 * needs depends on the capture, so the bar and the mark move together off a single
 * value rather than being nudged into agreement separately.
 *
 * Both team colours reach CSS as custom properties, so the accent stripes follow
 * the board without any component here knowing what a colour is.
 */
export default function Scoreboard() {
  return (
    <Scene className="vg flex flex-col items-center" vars={{ '--home': 'home.color', '--away': 'away.color' }}>
      <div className="vg-bar flex items-stretch text-white">
        {/*
          The two sides mirror each other, and each name is a bounded flex item
          rather than one free to grow. `fit` measures the box it is in, and an
          unbounded box has room for anything -- so a long name overflowed the
          plate and was clipped by the scene instead of being scaled down.
          `min-w-0` is what lets a flex item be narrower than its own text.
        */}
        <div className="flex w-[30rem] items-center gap-5 pr-6 pl-10">
          <Variable name="home.name" fallback="Team A" transition="flip ease-sharp" fit className="vg-name min-w-0 flex-1 text-right" />
          <span className="vg-stripe" style={{ background: 'var(--home, #38bdf8)' }} />
        </div>

        <div className="vg-score">
          <Variable name="home.score" fallback="0" transition="slide-up ease-back" />
        </div>
        <div className="vg-pip" />
        <div className="vg-score">
          <Variable name="away.score" fallback="0" transition="slide-up ease-back" />
        </div>

        <div className="flex w-[30rem] items-center gap-5 pr-10 pl-6">
          <span className="vg-stripe" style={{ background: 'var(--away, #fb7185)' }} />
          <Variable name="away.name" fallback="Team B" transition="flip ease-sharp" fit className="vg-name min-w-0 flex-1 text-left" />
        </div>
      </div>

      {/* Under the bar rather than inside it: a mark squeezed between two team names
          is unreadable at broadcast size, and it is the one thing here nobody needs
          to read quickly. Nothing paints until an image is picked. */}
      <div className="vg-logo">
        <Image name="logo" alt="" />
      </div>
    </Scene>
  )
}
