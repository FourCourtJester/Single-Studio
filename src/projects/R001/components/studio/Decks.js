// Import core components
import { Col } from 'react-bootstrap'

// Import our components
import { useStudio } from 'hooks'
import Deck from './Deck'

// Import style
// ...

/**
 * Studio: Command & Conquer - Decks
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
function Decks(properties) {
  // Properties
  const { player } = properties
  // Redux
  const faction = useStudio(`variables.players.${player}.deck.faction`)

  return (
    <Col>
      {faction === 'GDI' && <Deck faction="GDI" player={player} />}
      {faction === 'Nod' && <Deck faction="Nod" player={player} />}
    </Col>
  )
}

// Exported Component for use
export default Decks
