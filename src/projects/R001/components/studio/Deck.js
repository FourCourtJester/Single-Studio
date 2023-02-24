// Import core components
import { Col, Row } from 'react-bootstrap'

// Import our components
import { useStudio } from 'hooks'
import { ResetButton, Toggle } from 'components/studio'
import arsenals from '../arsenals.json'

// Import style
// ...

/**
 * Studio: Command & Conquer - Deck
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
function Deck(properties) {
  // Properties
  const { faction, player } = properties
  // Hooks
  const playerName = useStudio(`variables.players.${player}.displayName`)
  // Variables

  return (
    <>
      <Row className="gx-2">
        <Col>
          <legend>
            {faction} Deck for <i>{playerName}</i>
          </legend>
        </Col>
        <Col xs="auto">
          <ResetButton label={`all decks of ${playerName}`} paths={[`variables.players.${player}.deck`, `toggles.players.${player}.deck`]} />
        </Col>
      </Row>
      <Row className="gx-2">
        {arsenals[faction].commanders.map((commander) => (
          <Col key={commander}>
            <Toggle image={`commanders/${commander}.jpg`} name={`players.${player}.deck.commander`} value={commander} variant="link" />
          </Col>
        ))}
      </Row>
      <Row className="g-2 mt-0">
        {arsenals[faction].units.barracks.map((unit) => (
          <Col key={unit} xs={2}>
            <Toggle image={`units/${unit}.webp`} name={`players.${player}.deck.units.${unit}`} />
          </Col>
        ))}
        {arsenals[faction].units.vehicles.map((unit) => (
          <Col key={unit} xs={2}>
            <Toggle image={`units/${unit}.webp`} name={`players.${player}.deck.units.${unit}`} />
          </Col>
        ))}
        {arsenals[faction].units.aircraft.map((unit) => (
          <Col key={unit} xs={2}>
            <Toggle image={`units/${unit}.webp`} name={`players.${player}.deck.units.${unit}`} />
          </Col>
        ))}
        {arsenals[faction].units.tech.map((unit) => (
          <Col key={unit} xs={2}>
            <Toggle image={`units/${unit}.webp`} name={`players.${player}.deck.units.${unit}`} />
          </Col>
        ))}
      </Row>
    </>
  )
}

// Exported Component for use
export default Deck
