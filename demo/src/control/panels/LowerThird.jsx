import { Field, Panel, Toggle } from '@single-studio/core/control'

/**
 * The name strap: who it names, and whether it is up.
 *
 * The toggle writes under `toggles`, which is a different namespace from `variables`
 * on purpose -- what is on screen and what it says are separate questions, and an
 * operator can type the next guest's name while the current one is still on air.
 */
export default function LowerThird() {
  return (
    <Panel title="Lower third">
      <Field name="guest.name" label="Name" placeholder="Alex Morgan" />
      <Field name="guest.role" label="Role" placeholder="Analyst" />
      <Toggle name="lowerthird" label="lower third" />
    </Panel>
  )
}
