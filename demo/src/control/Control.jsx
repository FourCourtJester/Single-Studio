import Actions from './panels/Actions'
import BreakPanel from './panels/Break'
import GameClock from './panels/GameClock'
import LowerThird from './panels/LowerThird'
import Scores from './panels/Scores'

/**
 * The operator's board: which panels it has, and in what order.
 *
 * Ordered the way a show runs rather than the way the code is organised -- scores
 * and clock are what somebody touches every thirty seconds, the strap a few times an
 * hour, the break twice. Panels live in ./panels, one per file.
 */
export default function Control() {
  return (
    <>
      <Scores />
      <Actions />
      <GameClock />
      <LowerThird />
      <BreakPanel />
    </>
  )
}
