import { Scene, Timer, Variable } from '@single-studio/core'

/** Add to OBS as a Browser source pointed at #/source/scoreboard */
export default function Scoreboard() {
  return (
    <Scene className="scoreboard flex items-start justify-center pt-8">
      <div className="flex items-stretch overflow-hidden rounded-lg bg-slate-950/90 text-white shadow-2xl ring-1 ring-white/10">
        <div className="flex w-56 items-center justify-end px-4 py-3 text-2xl font-semibold uppercase tracking-wide">
          <Variable name="home.name" fallback="Home" fit />
        </div>
        <div className="flex w-20 items-center justify-center bg-sky-600 text-4xl font-bold">
          <Variable name="home.score" fallback="0" />
        </div>
        <div className="flex w-24 flex-col items-center justify-center bg-slate-900 px-2 py-1">
          <span className="text-[10px] uppercase tracking-widest text-slate-400">
            <Variable name="period" fallback="1st" />
          </span>
          <Timer name="break" fallback="--:--" className="text-lg font-semibold" />
        </div>
        <div className="flex w-20 items-center justify-center bg-rose-600 text-4xl font-bold">
          <Variable name="away.score" fallback="0" />
        </div>
        <div className="flex w-56 items-center px-4 py-3 text-2xl font-semibold uppercase tracking-wide">
          <Variable name="away.name" fallback="Away" fit />
        </div>
      </div>
    </Scene>
  )
}
