import { Scene, Toggle, Variable } from '@single-studio/core/source'

/**
 * Add to OBS as a Browser source pointed at #/source/lower-third
 *
 * Slides in from the left and overshoots slightly before settling -- the move a
 * lower third has made since caption generators were hardware. `--ss-shift` is how
 * far it travels and `ease-back` is the overshoot; neither costs a line of JS.
 */
export default function LowerThird() {
  return (
    <Scene className="flex items-end p-16">
      <Toggle
        name="lowerthird"
        transition="slide-right ease-back opaque"
        className="w-full max-w-2xl"
        style={{ '--ss-shift': '48rem', '--ss-duration': '520ms' }}
      >
        <div className="overflow-hidden rounded-md bg-slate-950/90 shadow-2xl ring-1 ring-white/10">
          <div className="border-l-4 border-sky-500 px-6 py-4">
            <div className="text-3xl font-semibold text-white">
              {/* The card is already on screen, so a name change wipes rather than
                  moving the whole panel again. */}
              <Variable name="lowerthird.title" fallback="Title" transition="wipe ease-sharp" fit />
            </div>
            <div className="text-lg text-slate-300">
              <Variable name="lowerthird.subtitle" fallback="" />
            </div>
          </div>
        </div>
      </Toggle>
    </Scene>
  )
}
