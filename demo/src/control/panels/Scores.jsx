import { ColorPicker, Field, Panel, Stepper, SwapButton } from '@single-studio/core/control'

/**
 * Teams, scores and the colours the scoreboard paints itself with.
 *
 * Every control names a path and knows nothing about the graphic reading it. The
 * colours land on `home.color` and `away.color`, which Scoreboard maps onto CSS
 * custom properties -- so changing a team colour repaints the bar without running
 * any code on the change.
 */
export default function Scores() {
  return (
    <Panel title="Scores">
      <Field name="home.name" label="Home" placeholder="Home team" />
      <Stepper name="home.score" label="Home score" />
      <Stepper name="away.score" label="Away score" />
      <Field name="away.name" label="Away" placeholder="Away team" />

      {/* One button, four paths: names and scores move together or the swap is a bug. */}
      <SwapButton label="sides" names={['home.name', 'home.score', 'away.name', 'away.score']} />

      <ColorPicker name="home.color" label="Home colour" fallback="#0284c7" presets={['#0284c7', '#16a34a', '#ca8a04', '#7c3aed']} />
      <ColorPicker name="away.color" label="Away colour" fallback="#e11d48" presets={['#e11d48', '#ea580c', '#0891b2', '#4b5563']} />
    </Panel>
  )
}
