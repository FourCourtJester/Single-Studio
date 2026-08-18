import { Image, Scene, Toggle, Variable } from '@single-studio/core'

/**
 * Add to OBS as a Browser source pointed at #/source/guest
 *
 * The headshot comes from whatever the operator put on the path -- an upload stored
 * locally, a pasted URL, or a bundled file. This component does not know which, and
 * does not need to.
 */
export default function Guest() {
  return (
    <Scene className="flex items-end justify-start p-12">
      {/* Scales up into place, overshooting a touch on the way. */}
      <Toggle name="guest" transition="zoom ease-back" style={{ '--ss-duration': '420ms' }}>
        <div className="flex items-center gap-5 rounded-lg bg-slate-950/90 p-5 ring-1 ring-white/10">
          <div className="h-28 w-28 overflow-hidden rounded-full bg-slate-900 ring-2 ring-white/20">
            <Image name="guest.photo" alt="" className="guest-photo h-full w-full" />
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-semibold text-white">
              <Variable name="guest.name" fallback="Guest" transition="slide-up ease-out" fit />
            </span>
            <span className="text-lg text-slate-300">
              <Variable name="guest.title" fallback="" />
            </span>
          </div>
        </div>
      </Toggle>
    </Scene>
  )
}
