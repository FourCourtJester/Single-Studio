// Import core components
import { Image } from 'react-bootstrap'

// Import our components
import { usePublic, useStudio } from 'hooks'
import { Toggle } from 'components/source'
import arsenals from '../../arsenals.json'

// Import style
// ...

/**
 * Source: Command & Conquer - Deck
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
function Deck(properties) {
  // Properties
  const { player } = properties
  // Hooks
  const faction = useStudio(`variables.players.${player}.deck.faction`)
  const publik = usePublic()
  // Variables
  const arsenal = arsenals?.[faction]?.units || {}

  return (
    <div className="arsenal d-flex justify-content-center pb-2 w-100">
      {Object.values(arsenal).map((units) =>
        units.map((unit) => (
          <Toggle className="m-1" key={unit} name={`players.${player}.deck.units.${unit}`}>
            <Image src={`${publik}/units/${unit}.webp`} fluid />
          </Toggle>
        ))
      )}
    </div>
  )
}

// Exported Component for use
export default Deck
