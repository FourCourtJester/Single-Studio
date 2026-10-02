import { Field, Panel, Row, Stepper, SwapButton } from '@single-studio/core/control'

// A panel on the operator's board. Each control binds to a path; a graphic reading
// the same path shows what an operator types here.
//
// One row per child. A Row puts its controls side by side once the board is wide
// enough and stacks them in a slim dock; widths are twelfths, so 8 and 4 is two
// thirds and one.
export default function Scores() {
  return (
    <Panel title="Scores">
      <Row>
        <Field name="home.name" label="Home" placeholder="Home team" className="md:col-span-8" />
        <Stepper name="home.score" label="Home score" className="md:col-span-4" />
      </Row>
      <Row>
        <Field name="away.name" label="Away" placeholder="Away team" className="md:col-span-8" />
        <Stepper name="away.score" label="Away score" className="md:col-span-4" />
      </Row>
      <SwapButton label="Swap sides" names={['home.name', 'home.score', 'away.name', 'away.score']} />
    </Panel>
  )
}
