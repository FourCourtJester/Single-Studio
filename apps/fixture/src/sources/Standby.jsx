import { Scene, Slideshow } from '@single-studio/core/source'

/**
 * Add to OBS as a Browser source pointed at #/source/standby
 *
 * The holding slide, and the demo's only use of `Slideshow`. It plays whatever an
 * operator has filed under `units/` in the image library rather than a list kept
 * here, which is the point of the component: loading the show is dropping a folder
 * on the board.
 *
 * The dwell is deliberately short. This is the test rig, and a graphic the suite
 * has to watch for nine seconds to see change once is a graphic the suite stops
 * checking properly.
 *
 * The drift is below, not in the framework. `Slideshow` says which picture is on
 * and cross-fades between them; what a slide *does* is a stylesheet's business,
 * the same way a transition is a class name.
 */
export default function Standby() {
  return (
    <Scene className="standby">
      <Slideshow group="units" every={2} order="shuffle" />
    </Scene>
  )
}
