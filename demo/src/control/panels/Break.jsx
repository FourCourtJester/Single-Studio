import { Countdown, Field, Panel } from '@single-studio/core/control'

/**
 * The break: how long it runs, and what the holding card says.
 *
 * There is deliberately no control here for *which* pictures play. Standby points at
 * the `standby` group of the image library, so loading the show is dropping a folder
 * on the board -- the header's image store is where that happens, and a list in this
 * panel would be a second place to keep in step with the first.
 */
export default function BreakPanel() {
  return (
    <Panel title="Break">
      <Countdown name="break" label="Back in" duration="5:00" />
      <Field name="break.label" label="Says" placeholder="Back in" />
      <Field name="break.note" label="Note" placeholder="Second half at 8pm" />
      <Field name="standby.title" label="Standby title" placeholder="Back shortly" />
      <Field name="standby.note" label="Standby note" placeholder="Coverage resumes shortly" />
    </Panel>
  )
}
