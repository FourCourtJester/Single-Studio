// Import core components
import { Col, Row } from 'react-bootstrap'

// Import our components
import { Cycle, SwapButton, Timer, Toggle, Variable } from 'components/studio'

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
      <Row>
        <Col>
          <Row>
            <Col>
              <legend className="m-0">Player One</legend>
            </Col>
            <Col xs="auto">
              <SwapButton
                fields={[
                  'players.1.displayName',
                  'players.1.score',
                  'players.1.alliance',
                  'players.1.faction',
                  'players.2.displayName',
                  'players.2.score',
                  'players.2.alliance',
                  'players.2.faction',
                ]}
              />
            </Col>
          </Row>
        </Col>
        <Col>
          <Row>
            <Col>
              <legend className="m-0">Player Two</legend>
            </Col>
          </Row>
        </Col>
      </Row>
      <Row>
        <Col>
          <Row>
            <Col>
              <Row className="gx-2">
                <Col>
                  <Variable label="Player Name" name="players.1.displayName" />
                </Col>
                <Col xs={2}>
                  <Variable as="number" label="Score" name="players.1.score" />
                </Col>
              </Row>
              <Row className="gx-2">
                <Col>
                  <Variable label="Alliance" name="players.1.alliance" />
                </Col>
                <Col xs={2}>
                  <Cycle choices={['GDI', 'Nod']} name="players.1.faction" />
                </Col>
              </Row>
            </Col>
          </Row>
        </Col>
        <Col>
          <Row>
            <Col>
              <Row className="gx-2">
                <Col>
                  <Variable label="Player Name" name="players.2.displayName" />
                </Col>
                <Col xs={2}>
                  <Variable as="number" label="Score" name="players.2.score" />
                </Col>
              </Row>
              <Row className="gx-2">
                <Col>
                  <Variable label="Alliance" name="players.2.alliance" />
                </Col>
                <Col xs={2}>
                  <Cycle choices={['GDI', 'Nod']} name="players.2.faction" />
                </Col>
              </Row>
            </Col>
          </Row>
        </Col>
      </Row>
      <hr />
      <Row>
        <Col>
          <Row className="gx-2">
            <Col>
              <legend>Missile</legend>
            </Col>
            <Col xs="auto">
              <Toggle icon="rocket" name="missile.1.player.1" group={['missile.1.player.1', 'missile.1.player.2']} />
            </Col>
            <Col xs="auto">
              <Toggle icon="rocket" name="missile.2.player.1" group={['missile.2.player.1', 'missile.2.player.2']} />
            </Col>
            <Col xs="auto">
              <Toggle icon="rocket" name="missile.3.player.1" group={['missile.3.player.1', 'missile.3.player.2']} />
            </Col>
          </Row>
        </Col>
        <Col>
          <Row className="gx-2">
            <Col>
              <legend>Missile</legend>
            </Col>
            <Col xs="auto">
              <Toggle icon="rocket" name="missile.1.player.2" group={['missile.1.player.1', 'missile.1.player.2']} />
            </Col>
            <Col xs="auto">
              <Toggle icon="rocket" name="missile.2.player.2" group={['missile.2.player.1', 'missile.2.player.2']} />
            </Col>
            <Col xs="auto">
              <Toggle icon="rocket" name="missile.3.player.2" group={['missile.3.player.1', 'missile.3.player.2']} />
            </Col>
          </Row>
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
