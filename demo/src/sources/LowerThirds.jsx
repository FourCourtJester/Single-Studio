import { Scene, Toggle, Variable } from '@single-studio/core/source'

/** One strap. The accent is the only thing that tells the two apart at a glance. */
function Strap({ which, bar, tag }) {
  return (
    <div className="w-[28rem] overflow-hidden rounded-md bg-slate-950/95 shadow-2xl ring-1 ring-white/10">
      <div className={`h-1 ${bar}`} />
      <div className="px-6 py-4">
        <div className="text-3xl font-semibold text-white">
          <Variable name={`third.${which}.name`} fallback="Name" fit />
        </div>
        <div className={`mt-1 font-mono text-sm font-medium tracking-wide ${tag}`}>
          <Variable name={`third.${which}.tag`} fallback="" />
        </div>
      </div>
    </div>
  )
}

/**
 * Two name straps, side by side. `#/source/lower-thirds` in OBS.
 *
 * Bottom left, leaving the right for chat. `Toggle` renders its strap always and
 * shows it while the toggle is on, so there is something to animate in and out
 * rather than a box appearing from nothing -- and a strap that is down still holds
 * its place, so the second one never jumps sideways when the first goes.
 *
 * Two different entrances, because those are the two a show reaches for. The host
 * slides in from the edge of the screen and back out of it; the guest fades, which
 * reads as quieter and suits whoever is not anchoring.
 */
export default function LowerThirds() {
  return (
    <Scene className="flex items-end justify-start gap-6 p-12">
      <Toggle name="third.one" transition="slide-right ease-back" style={{ '--ss-shift': '6rem', '--ss-duration': '450ms' }}>
        <Strap which="one" bar="bg-sky-500" tag="text-sky-400" />
      </Toggle>

      {/* No direction is a fade. A longer one than the default, so it reads as a fade and not a blink. */}
      <Toggle name="third.two" style={{ '--ss-duration': '600ms' }}>
        <Strap which="two" bar="bg-violet-500" tag="text-violet-300" />
      </Toggle>
    </Scene>
  )
}
