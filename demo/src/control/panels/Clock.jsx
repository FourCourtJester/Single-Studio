import { Cycle, Panel, Row, Toggle } from '@single-studio/core/control'

/**
 * The wall clock in the corner: whether it is up, and how it reads.
 *
 * `Cycle` steps through its options and back round to unset, which here means "the
 * way this computer's language writes the time" -- so the default is right for the
 * viewer's region without anybody choosing.
 */
export default function Clock() {
  return (
    <Panel title="Clock">
      {/* The switch at its own width beside the format, from 640px. */}
      <Row className="sm:row-cols-2">
        <Toggle name="clock" label="clock" className="sm:col-auto" />
        <Cycle name="clock.format" label="Format" options={['24-hour', '12-hour']} />
      </Row>
    </Panel>
  )
}
