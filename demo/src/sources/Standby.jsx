import { Clock, Scene, Slideshow, Variable } from '@single-studio/core/source'

/**
 * The holding card, for before the show and the break. `#/source/standby` in OBS.
 *
 * `Slideshow` plays whatever an operator dropped into the `standby` group of the
 * image library -- nothing here lists the pictures, so loading the show is dropping
 * a folder on the board rather than a redeploy.
 *
 * Which picture is on screen comes off the clock rather than a counter, so a second
 * machine opening this graphic mid-show lands on the same one at the same instant.
 */
export default function Standby() {
  return (
    <Scene className="relative">
      <Slideshow group="standby" every={9} order="shuffle" className="absolute inset-0" fit="cover" />

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-12 text-white">
        <div>
          <div className="text-5xl font-bold">
            <Variable name="standby.title" fallback="Back shortly" fit />
          </div>
          <div className="mt-2 text-lg text-slate-300">
            <Variable name="standby.note" fallback="" />
          </div>
        </div>

        {/* Wall clock, so the room can see the studio is live rather than frozen. */}
        <Clock className="text-2xl font-medium tabular-nums text-slate-400" />
      </div>
    </Scene>
  )
}
