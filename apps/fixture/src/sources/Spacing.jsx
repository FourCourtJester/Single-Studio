// A toggle with something above and below it, so the end-to-end suite can measure
// whether the page moves when it turns on. It should not: a Toggle keeps its
// children mounted and hides them, rather than removing them and collapsing.
//
// Also carries the same value twice, cut and faded, to check the variant reaches
// computed style.
import { Scene, Toggle, Variable } from '@single-studio/core/source'

export default function Probe() {
  return (
    <Scene className="flex flex-col items-start gap-0 p-4 text-white">
      <div className="marker-above h-6 bg-emerald-600">above</div>
      <Toggle name="probe" className="probe-toggle">
        <div className="h-24 w-40 bg-sky-600">inside the toggle</div>
      </Toggle>
      <div className="marker-below h-6 bg-rose-600">below</div>
      <Variable name="probe.text" fallback="A" transition="cut" className="probe-cut" />
      <Variable name="probe.text" fallback="A" className="probe-fade" />
    </Scene>
  )
}
