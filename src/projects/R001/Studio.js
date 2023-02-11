// Import core components
import { Col, Row } from 'react-bootstrap'

// Import our components
import { Cycle, Timer, Toggle, Variable } from 'components/studio'

// Import style
// ...

/**
 * Studio: Command & Conquer
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
function Studio() {
  return (
    <>
      <Row className="g-1">
        <Col>
          <legend>Player One</legend>
        </Col>
        <Col>
          <legend>Player Two</legend>
        </Col>
      </Row>
      <Row className="g-1 mt-1">
        <Col>
          <Row className="g-1">
            <Col>
              <Variable label="Player Name" name="players.one.displayName" />
            </Col>

            <Col xs={2}>
              <Variable as="number" label="Score" name="players.one.score" />
            </Col>
          </Row>
          <Row className="g-1 mt-1">
            <Col>
              <Variable label="Alliance" name="players.one.alliance" />
            </Col>
            <Col xs={2}>
              <Cycle choices={['GDI', 'Nod']} name="players.one.faction" />
            </Col>
          </Row>
        </Col>
        <Col />
      </Row>
      <hr />
      <Row className="g-1">
        <Col xs={3}>
          <legend>Player 1</legend>
        </Col>
        <Col xs={1}>
          <Toggle icon="rocket" name="missile.one.player.one" />
        </Col>
        <Col xs={1}>
          <Toggle icon="rocket" name="missile.two.player.one" />
        </Col>
        <Col xs={1}>
          <Toggle icon="rocket" name="missile.three.player.one" />
        </Col>
      </Row>
      <Row className="g-1 mt-1">
        <Col xs={3}>
          <legend>Player 2</legend>
        </Col>
        <Col xs={1}>
          <Toggle icon="rocket" name="missile.one.player.two" />
        </Col>
        <Col xs={1}>
          <Toggle icon="rocket" name="missile.two.player.two" />
        </Col>
        <Col xs={1}>
          <Toggle icon="rocket" name="missile.three.player.two" />
        </Col>
      </Row>
    </>
  )
}

// Exported Component for use
export default {
  name: 'Command & Conquer Rivals Test',
  Page: Studio,
}
