import { Scene, Sequence, SequenceItem } from '@single-studio/core/source'

/**
 * Add to OBS as a Browser source pointed at #/source/sequence
 *
 * Both ways a sequence starts, at timings short enough for the end-to-end suite to
 * watch several loops.
 *
 * The rotation runs forever off the room's clock: 1.2s, then 0.8s for the plain
 * child (which gets the sequence's `every`), then 1s, so one loop is 3s. The item of
 * no duration must never come on, and the tall one sets the box for all of them.
 *
 * The intro plays once when the board's intro toggle goes on, and holds its last
 * item until it goes off.
 */
export default function SequenceProbe() {
  return (
    <Scene className="flex flex-col items-start gap-8 p-12 text-2xl font-semibold text-white">
      <Sequence className="probe-rotation" every={0.8}>
        <SequenceItem duration={1.2}>One</SequenceItem>
        <SequenceItem duration={0}>Never</SequenceItem>
        <div className="h-24">Two</div>
        <SequenceItem duration={1} transition="cut">
          Three
        </SequenceItem>
      </Sequence>

      <Sequence className="probe-intro" name="intro" loop={false} every={0.6}>
        <span>Logo</span>
        <span>Home</span>
        <span>Away</span>
      </Sequence>
    </Scene>
  )
}
