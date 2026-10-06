import { Field, Panel, Row, Stepper, SwapButton } from '@single-studio/core/control'

// A panel on the operator's board. Each control binds to a path; a graphic reading
// the same path shows what an operator types here.
//
// One row per child. A Row puts its controls side by side once the board is wide
// enough and stacks them in a slim dock. `md:col-auto` keeps the score at its own
// width from there up and gives the name the rest of the line.
export default function Scores() {
  return (
    <Panel title="Scores">
      <Row>
        <Field name="home.name" label="Home" placeholder="Home team" />
        <Stepper name="home.score" label="Home score" className="md:col-auto" />
      </Row>
      <Row>
        <Field name="away.name" label="Away" placeholder="Away team" />
        <Stepper name="away.score" label="Away score" className="md:col-auto" />
      </Row>
      <SwapButton label="Swap sides" names={['home.name', 'home.score', 'away.name', 'away.score']} />
    </Panel>
  )
}
