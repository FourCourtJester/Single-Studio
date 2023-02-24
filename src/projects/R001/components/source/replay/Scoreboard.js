// Import core components
import { useEffect, useState } from 'react'
import { Image } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { usePublic, useStudio } from 'hooks'

// Import style
// ...

/**
 * Source: Command & Conquer - Scoreboard
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
function Deck(properties) {
  // Properties
  const { player, reverse } = properties
  // Hooks
  const publik = usePublic()
  // Redux
  const score = +useStudio(`variables.players.${player}.score`) || 0
  const faction = useStudio(`variables.players.${player}.deck.faction`)
  const series = +useStudio(`variables.series.game.max`) || 3
  // Variables
  const [gameNum, setGameNum] = useState([0, 0, 0])

  useEffect(() => {
    const n = Math.floor((series || 1) / 2) + 1
    setGameNum(Array(n).fill(() => 0))
  }, [series])

  return (
    <p className={cN('score d-flex', reverse ? 'flex-row-reverse' : 'flex-row', 'mb-1')}>
      {gameNum.map((_, i) => (
        <Image key={i} src={`${publik}/overlay/game/points/${faction}-${score <= i ? 0 : 1}.png`} />
      ))}
    </p>
  )
}

// Exported Component for use
export default Deck
