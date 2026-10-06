import { useVelcroMutate } from '@single-studio/core'
import { ColorPicker, Field, ImagePicker, Panel, Row, Stepper, SwapButton } from '@single-studio/core/control'

const button = 'rounded-md bg-sky-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500'

/**
 * One side's controls, in the order the scoreboard reads them. One to a line in a
 * dock, two from 640px, all four from 1024px -- where the score keeps its own width
 * and the name, logo and colour share what it leaves.
 */
function Team({ side, label, fallback, presets }) {
  return (
    <Row className="sm:row-cols-2 lg:row-cols-4">
      <Field name={`${side}.name`} label={label} placeholder={`${label} team`} />
      {/* A logo is a library entry: drop the file on the library, pick it here. */}
      <ImagePicker name={`${side}.logo`} label={`${label} logo`} />
      <Stepper name={`${side}.score`} label={`${label} score`} className="lg:col-auto" />
      <ColorPicker name={`${side}.color`} label={`${label} colour`} fallback={fallback} presets={presets} />
    </Row>
  )
}

/**
 * The two teams and the round.
 *
 * Every control names a path and knows nothing about the graphic reading it. The
 * colours land on `home.color` and `away.color`, which the scoreboard maps onto CSS
 * custom properties -- so changing a team colour repaints the bar without any code
 * running on the change.
 *
 * The buttons at the bottom are the part a form of controls cannot express: a round
 * won is a score *and* the next round, written as one mutation in
 * src/mutations/show.js so the two land on air together.
 */
export default function Scoreboard() {
  const mutate = useVelcroMutate()

  return (
    <Panel title="Scoreboard">
      <Team side="home" label="Home" fallback="#0284c7" presets={['#0284c7', '#16a34a', '#ca8a04', '#7c3aed']} />
      {/* Below 1024px a side is four or two lines of controls, and two sides of
          identical controls run together without a line between them. From there
          each side is one line and its labels say whose it is. */}
      <hr className="border-slate-800 lg:hidden" />
      <Team side="away" label="Away" fallback="#e11d48" presets={['#e11d48', '#ea580c', '#0891b2', '#4b5563']} />
      <hr className="border-slate-800 lg:hidden" />

      {/* The round takes the line and the swap only the room its words need, from 640px. */}
      <Row className="sm:row-cols-2">
        {/* A field, not a stepper: empty, its placeholder says what the scoreboard shows. */}
        <Field name="round" label="Round" placeholder="1" />
        {/* One button, every path a side owns: half a swap is a scoreboard that lies. */}
        <SwapButton
          className="sm:col-auto"
          label="Swap sides"
          names={['home.name', 'home.logo', 'home.score', 'home.color', 'away.name', 'away.logo', 'away.score', 'away.color']}
        />
      </Row>

      <Row className="sm:row-cols-3">
        <button type="button" onClick={() => mutate('demo:round', { team: 'home' })} className={button}>
          Home takes the round
        </button>
        <button type="button" onClick={() => mutate('demo:round', { team: 'away' })} className={button}>
          Away takes the round
        </button>
        <button
          type="button"
          onClick={() => mutate('demo:reset')}
          className="rounded-md bg-slate-700 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600"
        >
          New match
        </button>
      </Row>
    </Panel>
  )
}
