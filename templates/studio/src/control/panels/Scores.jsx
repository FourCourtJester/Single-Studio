import { Field, Panel, Stepper, SwapButton } from '@single-studio/core/control'

// A panel on the operator's board. Each control binds to a path; a graphic reading
// the same path shows what an operator types here.
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
