import { Scene, Toggle, Variable } from '@single-studio/core/source'

/**
 * A name strap. `#/source/lower-third` in OBS.
 *
 * `Toggle` renders its children always and shows them while the toggle is on, so the
 * animation has something to animate rather than appearing from nothing. An operator
 * presses one button; the strap slides in and out on its own.
 */
export default function LowerThird() {
  return (
    <Scene className="flex items-end justify-start p-12">
      <Toggle name="lowerthird" transition="slide-up ease-back">
        <div className="overflow-hidden rounded-md bg-slate-950/95 shadow-2xl ring-1 ring-white/10">
          <div className="h-1 bg-sky-500" />
          <div className="px-6 py-4">
            <div className="text-3xl font-semibold text-white">
              <Variable name="guest.name" fallback="Guest" fit />
            </div>
            <div className="mt-1 text-sm font-medium uppercase tracking-[0.2em] text-sky-400">
              <Variable name="guest.role" fallback="" />
            </div>
          </div>
        </div>
      </Toggle>
    </Scene>
  )
}
