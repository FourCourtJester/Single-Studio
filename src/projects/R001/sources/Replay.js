// Import core components
import { Col, Row } from 'react-bootstrap'

// Import our components
import { Image, Scene, Variable } from 'components/source'
import { useStudio } from 'hooks'

// Import style
import '../scss/project.scss'

/**
 * Source: Replay
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
function Page() {
  // Redux
  const scores = {
    left: +useStudio(`variables.players.1.score`) || 0,
    right: +useStudio(`variables.players.2.score`) || 0,
  }
  // Variables
  const series = [0, 0, 0]

  console.log(scores)

  return (
    <Scene id="replay" className="w-100 h-100">
      <Image className="position-absolute w-100 h-100 z-n1" name="map" src="maps/:var:.jpg" />
      <div className="players d-flex flex-row justify-content-between align-items-start">
        <div className="player left d-flex flex-column justify-content-end align-items-center">
          <div className="plate position-relative d-flex flex-column justify-content-end align-items-center w-100">
            <p className="score d-flex flex-row mb-1">
              {series.map((n, i) => (
                <Image key={i} src={`overlay/game/points/NOD-${scores.left <= i ? 0 : 1}.png`} />
              ))}
            </p>
            <Variable className="player-name position-absolute bottom-0 left-0 text-uppercase text-center w-100" name="players.1.displayName" />
          </div>
          <Image className="commander" name="players.1.deck.commander" src="commanders/transparent/:var:.png" />
        </div>
        <div className="player right d-flex flex-column justify-content-end align-items-center">
          <div className="plate position-relative d-flex flex-column justify-content-end align-items-center w-100">
            <p className="score d-flex flex-row-reverse mb-1">
              {series.map((n, i) => (
                <Image key={i} src={`overlay/game/points/GDI-${scores.right <= i ? 0 : 1}.png`} />
              ))}
            </p>
            <Variable className="player-name position-absolute bottom-0 left-0 text-uppercase text-center w-100" name="players.2.displayName" />
          </div>
          <Image className="commander" name="players.2.deck.commander" src="commanders/transparent/:var:.png" />
        </div>
      </div>
      <Row className="bar position-relative w-100">
        <Col className="d-flex justify-content-end align-items-center">
          <var className="text-uppercase">Quarter Finals</var>
        </Col>
        <Col className="d-flex justify-content-center align-items-center" xs="auto">
          <Image src="overlay/logo.png" />
        </Col>
        <Col className="d-flex justify-content-start align-items-center">
          <var className="text-uppercase">Game 1 of 5</var>
        </Col>
      </Row>
    </Scene>
  )
}

// Exported Component for use
export default Page
