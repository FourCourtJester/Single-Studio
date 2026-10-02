import { useVelcroMutate } from '@single-studio/core'
import { ColorPicker, Field, ImagePicker, Panel, Stepper, SwapButton } from '@single-studio/core/control'

const button = 'rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500'

/** One side's controls, top to bottom in the order the scoreboard reads them. */
function Team({ side, label, fallback, presets }) {
  return (
    <div className="flex flex-col gap-3">
      <Field name={`${side}.name`} label={label} placeholder={`${label} team`} />
      {/* A logo is a library entry: drop the file on the library, pick it here. */}
      <ImagePicker name={`${side}.logo`} label={`${label} logo`} />
      <Stepper name={`${side}.score`} label={`${label} score`} />
      <ColorPicker name={`${side}.color`} label={`${label} colour`} fallback={fallback} presets={presets} />
    </div>
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
      <Team side="away" label="Away" fallback="#e11d48" presets={['#e11d48', '#ea580c', '#0891b2', '#4b5563']} />

      <div className="flex flex-col gap-3">
        {/* A field, not a stepper: empty, its placeholder says what the scoreboard shows. */}
        <Field name="round" label="Round" placeholder="1" />
        {/* One button, every path a side owns: half a swap is a scoreboard that lies. */}
        <SwapButton label="sides" names={['home.name', 'home.logo', 'home.score', 'home.color', 'away.name', 'away.logo', 'away.score', 'away.color']} />
      </div>

      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => mutate('demo:round', { team: 'home' })} className={button}>
          Home takes the round
        </button>
        <button type="button" onClick={() => mutate('demo:round', { team: 'away' })} className={button}>
          Away takes the round
        </button>
        <button
          type="button"
          onClick={() => mutate('demo:reset')}
          className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
        >
          New match
        </button>
      </div>
    </Panel>
  )
}
