// Import core components
import { Col, Row } from 'react-bootstrap'

// Import our components
import { Cycle, ResetButton, SwapButton, Timer, Toggle, Variable } from 'components/studio'
import { Decks, Maps } from './components/studio'

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
                  'players.1.deck.faction',
                  'players.2.displayName',
                  'players.2.score',
                  'players.2.alliance',
                  'players.2.deck.faction',
                ]}
                label="Players"
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
                  <Cycle name="players.1.deck.faction" choices={['GDI', 'Nod']} image="logos/:choice:.png" variant="link" />
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
                  <Cycle choices={['GDI', 'Nod']} name="players.2.deck.faction" image="logos/:choice:.png" variant="link" />
                </Col>
              </Row>
            </Col>
          </Row>
        </Col>
      </Row>
      <Row>
        <Col>
          <legend>Series</legend>
        </Col>
      </Row>
      <Row>
        <Col>
          <Row className="gx-2">
            <Col>
              <Timer label="Countdown" name="countdown" />
            </Col>
            <Col>
              <Variable label="Round" name="series.round" />
            </Col>
          </Row>
        </Col>
        <Col>
          <Row className="gx-2">
            <Col>
              <Variable as="number" label="Game" name="series.game.current" />
            </Col>
            <Col className="d-flex align-items-center" xs="auto">
              <span>of</span>
            </Col>
            <Col>
              <Variable as="number" label="Limit" name="series.game.max" />
            </Col>
          </Row>
        </Col>
      </Row>
      <hr />
      <Row>
        <Col>
          <legend>Map &amp; Missiles</legend>
        </Col>
        <Col xs="auto">
          <ResetButton paths={['toggles.missile', 'variables.map']} label="Map & Missiles" />
        </Col>
      </Row>
      <Row>
        <Col>
          <Row className="d-flex flex-row align-items-center h-100 gx-2">
            <Col>
              <Toggle icon="rocket" name="missile.1.player.1" group={['missile.1.player.1', 'missile.1.player.2']} />
            </Col>
            <Col>
              <Toggle icon="rocket" name="missile.2.player.1" group={['missile.2.player.1', 'missile.2.player.2']} />
            </Col>
            <Col>
              <Toggle icon="rocket" name="missile.3.player.1" group={['missile.3.player.1', 'missile.3.player.2']} />
            </Col>
          </Row>
        </Col>
        <Col>
          <Maps />
        </Col>
        <Col>
          <Row className="d-flex flex-row align-items-center h-100 gx-2">
            <Col>
              <Toggle icon="rocket" name="missile.1.player.2" variant="danger" group={['missile.1.player.1', 'missile.1.player.2']} />
            </Col>
            <Col>
              <Toggle icon="rocket" name="missile.2.player.2" variant="danger" group={['missile.2.player.1', 'missile.2.player.2']} />
            </Col>
            <Col>
              <Toggle icon="rocket" name="missile.3.player.2" variant="danger" group={['missile.3.player.1', 'missile.3.player.2']} />
            </Col>
          </Row>
        </Col>
      </Row>
      <hr />
      <Row>
        <Col>
          <Decks player="1" />
        </Col>
        <Col>
          <Decks player="2" />
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
