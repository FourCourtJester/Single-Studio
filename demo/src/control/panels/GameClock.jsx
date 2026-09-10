import { Break, Cycle, Panel, ResetButton, Stopwatch } from '@single-studio/core/control'

/**
 * The game clock and the period.
 *
 * `Stopwatch` counts up and stores the instant it started, so the number on air is
 * arithmetic rather than a tick somebody has to keep. Scoreboard gives it a `limit`
 * of 12:00, which is what turns it amber when a period runs long -- the rule lives
 * with the graphic, not here.
 */
export default function GameClock() {
  return (
    <Panel title="Clock">
      <Stopwatch name="game" label="Game clock" />
      <Cycle name="period" label="Period" options={['1st', '2nd', '3rd', 'OT']} />
      <Break />
      <ResetButton label="the scores" names={['home.score', 'away.score']} />
    </Panel>
  )
}
