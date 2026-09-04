import { useVelcroMutate } from '@single-studio/core'
import { Break, ColorPicker, Field, ImagePicker, Panel, Stepper, SwapButton } from '@single-studio/core/control'

/** One side. Same controls both, so the board reads the way the bar does. */
// The near-white preset is gone on purpose: the score block is now filled with
// this colour and the numeral on it is white, so offering a near-white swatch was
// offering an invisible score.
function Side({ side, title, colour }) {
  return (
    <>
      <Field name={`${side}.name`} label={title} placeholder={title} />
      <Stepper name={`${side}.score`} label={`${title} score`} />
      <ColorPicker
        name={`${side}.color`}
        label={`${title} accent`}
        fallback={colour}
        presets={['#38bdf8', '#fb7185', '#eab308', '#22c55e', '#a855f7', '#f97316']}
      />
    </>
  )
}

export default function Match() {
  const mutate = useVelcroMutate()

  return (
    <Panel title="Match">
      <Side side="home" title="Team A" colour="#38bdf8" />
      <Break />
      <Side side="away" title="Team B" colour="#fb7185" />
      <Break />

      {/* Both names and both scores move together, in one change. */}
      <SwapButton label="Swap sides" names={['home.name', 'home.score', 'away.name', 'away.score']} />
      <button
        type="button"
        onClick={() => mutate('match:reset')}
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
      >
        Reset scores
      </button>
      <Break />

      {/* Upload it once and it stays: the store keeps it, and the bar shows nothing
          at all until it is picked. */}
      <ImagePicker name="logo" label="Tournament mark" />
    </Panel>
  )
}
