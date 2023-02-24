// Import core components
import { Col, Row } from 'react-bootstrap'

// Import our components
import { Image, Scene, Timer, Variable } from 'components/source'
import { ReplayDeck as Deck, ReplayScoreboard as Scoreboard } from '../components/source'

// Import style
import '../scss/project.scss'

/**
 * Source: Replay
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
function Page() {
  return (
    <Scene id="replay" className="w-100 h-100">
      <Image className="position-absolute w-100 h-100 z-n1" name="map" src="maps/:var:.jpg" />
      <div className="players position-relative d-flex flex-row justify-content-between align-items-start">
        {/* Player Left */}
        <div className="player left position-relative d-flex flex-column justify-content-between align-items-center h-100">
          <Image className="commander position-absolute left-0 z-n1" name="players.1.deck.commander" src="commanders/transparent/:var:.png" />
          <div className="plate position-relative d-flex flex-column justify-content-end align-items-center w-100">
            <Scoreboard player="1" />
            <div className="player-name position-absolute top-100 left-0 d-flex flex-column align-items-center text-uppercase w-100">
              <Variable name="players.1.displayName" />
              <Variable name="players.1.alliance" />
            </div>
          </div>
          <Deck player="1" />
        </div>
        {/* Player Right */}
        <div className="player right position-relative d-flex flex-column justify-content-between align-items-center h-100">
          <Image className="commander position-absolute left-0 z-n1" name="players.2.deck.commander" src="commanders/transparent/:var:.png" />
          <div className="plate position-relative d-flex flex-column justify-content-end align-items-center w-100">
            <Scoreboard player="2" reverse />
            <div className="player-name position-absolute top-100 left-0 d-flex flex-column align-items-center text-uppercase w-100">
              <Variable name="players.2.displayName" />
              <Variable name="players.2.alliance" />
            </div>
          </div>
          <Deck player="2" />
        </div>
      </div>
      {/* Bottom Bar */}
      <Row className="bar position-relative w-100">
        <Col className="d-flex justify-content-end align-items-center">
          <Variable className="text-uppercase" name="series.round" />
        </Col>
        <Col className="d-flex justify-content-center align-items-center" xs="auto">
          <Image src="overlay/logo.png" />
        </Col>
        <Col className="d-flex justify-content-start align-items-center text-prewrap text-uppercase">
          Game&nbsp;
          <Variable name="series.game.current" />
          &nbsp;of&nbsp;
          <Variable name="series.game.max" />
        </Col>
      </Row>
      {/* Map */}
      <div className="map position-absolute d-flex flex-column align-items-center left-0 pb-5 w-100">
        <Timer className="position-relative" name="countdown" />
        <Image className="position-relative" name="map" src="maps/preview/:var:.webp" />
      </div>
    </Scene>
  )
}

// Exported Component for use
export default Page
