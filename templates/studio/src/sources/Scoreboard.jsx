import { Scene, Variable } from '@single-studio/core'

// Add to OBS as a Browser source pointed at #/source/scoreboard
export default function Scoreboard() {
  return (
    <Scene className="flex items-start justify-center pt-8">
      <div className="flex items-stretch overflow-hidden rounded-lg bg-slate-950/90 text-white ring-1 ring-white/10">
        <div className="flex w-48 items-center justify-end px-4 py-3 text-2xl font-semibold uppercase">
          <Variable name="home.name" fallback="Home" fit />
        </div>
        <div className="flex w-16 items-center justify-center bg-sky-600 text-3xl font-bold">
          <Variable name="home.score" fallback="0" />
        </div>
        <div className="flex w-16 items-center justify-center bg-rose-600 text-3xl font-bold">
          <Variable name="away.score" fallback="0" />
        </div>
        <div className="flex w-48 items-center px-4 py-3 text-2xl font-semibold uppercase">
          <Variable name="away.name" fallback="Away" fit />
        </div>
      </div>
    </Scene>
  )
}
