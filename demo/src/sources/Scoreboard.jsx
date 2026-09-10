import { Scene, Timer, Variable } from '@single-studio/core/source'

/**
 * The programme scoreboard. `#/source/scoreboard` in OBS.
 *
 * Every value here is a path an operator types into, and nothing on this page knows
 * that a board exists -- the pairing is the path and nothing else. `vars` maps two
 * of those paths onto CSS custom properties, so an operator picking a team colour
 * repaints the bar without a single line of JavaScript running on the change.
 */
export default function Scoreboard() {
  return (
    <Scene className="flex items-start justify-center pt-8" vars={{ '--home': 'home.color', '--away': 'away.color' }}>
      <div className="flex items-stretch overflow-hidden rounded-lg bg-slate-950/90 text-white shadow-2xl ring-1 ring-white/10">
        <div className="flex w-52 items-center justify-end px-4 py-3 text-2xl font-semibold uppercase tracking-wide">
          {/* `fit` shrinks a long team name rather than letting it push the bar wider. */}
          <Variable name="home.name" fallback="Home" fit />
        </div>

        <div className="flex w-16 items-center justify-center text-3xl font-bold tabular-nums" style={{ background: 'var(--home, #0284c7)' }}>
          <Variable name="home.score" fallback="0" transition="zoom ease-back" />
        </div>

        {/*
          The clock sits between the scores because that is where an operator's eye
          already is. `data-over` lands on it when a count-up passes `limit`, which
          the stylesheet below turns amber -- no timer in this file, and no state.
        */}
        <div className="flex w-24 flex-col items-center justify-center bg-slate-900 px-2 py-2">
          <Timer name="game" limit="12:00" fallback="00:00" className="text-xl font-bold tabular-nums data-[over]:text-amber-400" />
          <Variable name="period" fallback="1st" className="text-[10px] font-medium uppercase tracking-widest text-slate-400" />
        </div>

        <div className="flex w-16 items-center justify-center text-3xl font-bold tabular-nums" style={{ background: 'var(--away, #e11d48)' }}>
          <Variable name="away.score" fallback="0" transition="zoom ease-back" />
        </div>

        <div className="flex w-52 items-center px-4 py-3 text-2xl font-semibold uppercase tracking-wide">
          <Variable name="away.name" fallback="Away" fit />
        </div>
      </div>
    </Scene>
  )
}
