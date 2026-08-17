import { Field, Panel, Stepper, SwapButton } from '@single-studio/core'

// Your operator's board. Every control binds to a path; writes land as you type,
// so there is no save step.
export default function Control() {
  return (
    <Panel title="Scores">
      <Field name="home.name" label="Home" placeholder="Home team" />
      <Stepper name="home.score" label="Home score" />
      <Stepper name="away.score" label="Away score" />
      <Field name="away.name" label="Away" placeholder="Away team" />
      <SwapButton label="sides" paths={['variables.home.name', 'variables.home.score', 'variables.away.score', 'variables.away.name']} />
    </Panel>
  )
}
