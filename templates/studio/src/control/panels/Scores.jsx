// YOURS — a panel on the board.
import { Field, Panel, Stepper, SwapButton } from '@single-studio/core/control'

// One panel, in its own file. Add another beside it and put it in Control.jsx.
//
// Every control binds to a path and knows nothing about any other, so a panel is
// plain composition -- there is no wiring between these and the graphics that read
// the same paths.
export default function Scores() {
  return (
    <Panel title="Scores">
      <Field name="home.name" label="Home" placeholder="Home team" />
      <Stepper name="home.score" label="Home score" />
      <Stepper name="away.score" label="Away score" />
      <Field name="away.name" label="Away" placeholder="Away team" />
      <SwapButton label="sides" names={['home.name', 'home.score', 'away.name', 'away.score']} />
    </Panel>
  )
}
