import { Scene, Timer, Variable } from '@single-studio/core/source'

/**
 * "Back in 5:00", counting down. `#/source/break-timer` in OBS.
 *
 * The countdown stores the instant it ends rather than the seconds left, so nothing
 * ticks and nothing drifts: every output derives the same number from the same
 * stored timestamp, and a graphic opened with two minutes to go joins at two minutes
 * rather than starting again at five.
 */
export default function BreakTimer() {
  return (
    <Scene className="flex items-center justify-center bg-slate-950">
      <div className="text-center text-white">
        <div className="text-sm font-medium uppercase tracking-[0.3em] text-sky-400">
          <Variable name="break.label" fallback="Back in" />
        </div>

        <Timer name="break" as="div" fallback="0:00" className="mt-3 text-8xl font-bold tabular-nums data-[over]:text-rose-500" />

        <div className="mt-4 text-lg text-slate-400">
          <Variable name="break.note" fallback="" />
        </div>
      </div>
    </Scene>
  )
}
