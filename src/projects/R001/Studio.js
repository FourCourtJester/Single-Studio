// Import core components
import { Col, Row } from 'react-bootstrap'

// Import our components
import { Timer, Toggle, Variable } from 'components/studio'

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
      <legend className="mb-0">Players</legend>
      <Row className="g-3 mt-1">
        <Col>
          <Variable label="Player One" name="players.one.displayName" placeholder="Player One Name" />
        </Col>
        <Col>
          <Variable label="Player Two" name="players.two.displayName" placeholder="Player Two Name" />
        </Col>
      </Row>
      <Row className="g-3 mt-1">
        <Col>
          <Toggle label="Player One" name="players" />
        </Col>
        <Col>
          <Timer label="Countdown" name="players" />
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
