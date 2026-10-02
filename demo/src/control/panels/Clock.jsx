import { Cycle, Panel, Toggle } from '@single-studio/core/control'

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
      <Toggle name="clock" label="clock" />
      <Cycle name="clock.format" label="Format" options={['24-hour', '12-hour']} />
    </Panel>
  )
}
