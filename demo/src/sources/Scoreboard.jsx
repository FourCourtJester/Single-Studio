import { Image, Scene, Variable } from '@single-studio/core/source'

/** One side: logo, name, score, mirrored for the away team. */
function Side({ side, fallback, colour, away = false }) {
  return (
    <div className={`flex items-stretch ${away ? 'flex-row-reverse' : ''}`}>
      {/*
        The logo is whatever the operator picked from the image library. Empty, it
        draws nothing and the box stays, so a team without a logo yet does not
        shift the whole bar sideways.
      */}
      <div className="flex w-16 items-center justify-center bg-white/5 p-2">
        <Image name={`${side}.logo`} fit="contain" className="h-10 w-10" transition="zoom ease-back" />
      </div>

      <div className={`flex w-52 items-center px-4 py-3 text-2xl font-semibold uppercase tracking-wide ${away ? 'justify-start' : 'justify-end'}`}>
        {/* `fit` shrinks a long team name rather than letting it push the bar wider. */}
        <Variable name={`${side}.name`} fallback={fallback} fit />
      </div>

      <div className="flex w-16 items-center justify-center text-3xl font-bold tabular-nums" style={{ background: `var(--${side}, ${colour})` }}>
        <Variable name={`${side}.score`} fallback="0" transition="zoom ease-back" />
      </div>
    </div>
  )
}

/**
 * The match scoreboard. `#/source/scoreboard` in OBS.
 *
 * Top centre, the one place every viewer looks first. Every value here is a path an
 * operator types into, and nothing on this page knows that a board exists -- the
 * pairing is the path and nothing else. `vars` maps the two colour paths onto CSS
 * custom properties, so an operator picking a team colour repaints the bar without a
 * line of JavaScript running on the change.
 */
export default function Scoreboard() {
  return (
    <Scene className="flex items-start justify-center pt-8" vars={{ '--home': 'home.color', '--away': 'away.color' }}>
      <div className="flex items-stretch overflow-hidden rounded-lg bg-slate-950/90 text-white shadow-2xl ring-1 ring-white/10">
        <Side side="home" fallback="Home" colour="#0284c7" />

        <div className="flex w-24 flex-col items-center justify-center bg-slate-900 px-2 py-2">
          <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Round</span>
          <Variable name="round" fallback="1" transition="slide-up ease-out" className="text-2xl font-bold tabular-nums" />
        </div>

        <Side side="away" fallback="Away" colour="#e11d48" away />
      </div>
    </Scene>
  )
}
