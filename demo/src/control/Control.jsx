import Clock from './panels/Clock'
import LowerThirds from './panels/LowerThirds'
import Scoreboard from './panels/Scoreboard'
import Static from './panels/Static'
import Twitch from './panels/Twitch'

/**
 * The operator's board: which panels it has, and in what order.
 *
 * Ordered the way a show runs rather than the way the code is organised -- the
 * scoreboard is touched every round, the lower thirds a few times an hour, the
 * static card at the start and the breaks, the clock once, and Twitch looks after
 * itself. Panels live in ./panels, one per file.
 */
export default function Control() {
  return (
    <>
      <Scoreboard />
      <LowerThirds />
      <Static />
      <Clock />
      <Twitch />
    </>
  )
}
