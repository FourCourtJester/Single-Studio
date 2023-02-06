// Import core components
import { Col, FloatingLabel, Form, Row } from 'react-bootstrap'

// Import our components
// ...

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
      <legend>Players</legend>
      <Row>
        <Col>
          <FloatingLabel label="Player One" controlId="players.one.displayName">
            <Form.Control name="players.one.displayName" type="text" placeholder="Player One Name" />
          </FloatingLabel>
        </Col>
        <Col>
          <FloatingLabel label="Player Two"  controlId="players.two.displayName">
            <Form.Control name="players.two.displayName" type="text" placeholder="Player Two Name" />
          </FloatingLabel>
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
