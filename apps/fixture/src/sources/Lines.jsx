// Fit on more than one line, against Fit on one, in identical boxes, so the
// end-to-end suite can measure what wrapping buys. Every box is 360px wide and
// 48px text, and nothing here reads the show: the text is fixed, or a Variable's
// fallback, so the measurements cannot move with whatever the board last saved.
import { Fit } from '@single-studio/core'
import { Scene, Variable } from '@single-studio/core/source'

const LONG = 'Vandersteen-Rodriguez Northwind Esports'
const box = 'w-[360px] border border-white/20 text-5xl leading-tight'

export default function Lines() {
  return (
    <Scene className="flex flex-col items-start gap-4 p-4 text-white">
      <div className={`${box} lines-one`}>
        <Fit>{LONG}</Fit>
      </div>
      <div className={`${box} lines-two`}>
        <Fit lines={2}>{LONG}</Fit>
      </div>
      {/* Fits as it is: nothing to shrink, and no reason to wrap. */}
      <div className={`${box} lines-short`}>
        <Fit lines={2}>Kim</Fit>
      </div>
      {/* One word wider than the box. Wrapping cannot help, so it shrinks. */}
      <div className={`${box} lines-word`}>
        <Fit lines={3}>Supercalifragilisticexpialidocious</Fit>
      </div>
      <div className={`${box} lines-variable`}>
        <Variable name="fixture.lines" fallback={LONG} fit lines={2} />
      </div>
    </Scene>
  )
}
