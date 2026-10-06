import { Field, Panel, Row, Toggle } from '@single-studio/core/control'

/**
 * One strap: who it names, and the switch that puts it up. Stacked in a dock, the
 * two names side by side from 640px, and the switch beside them at its own width
 * from 1024px.
 */
function Third({ which, label, name, tag }) {
  return (
    <Row className="sm:row-cols-2 lg:row-cols-3">
      <Field name={`third.${which}.name`} label={`${label} name`} placeholder={name} />
      <Field name={`third.${which}.tag`} label={`${label} gamertag`} placeholder={tag} />
      <Toggle name={`third.${which}`} label={label.toLowerCase()} className="lg:col-auto" />
    </Row>
  )
}

/**
 * Two name straps, each on its own toggle, so either or both can be up.
 *
 * The toggles write under `toggles`, a different namespace from the names under
 * `variables`, on purpose: what is on screen and what it says are separate
 * questions, and an operator can type the next guest's name while the current one is
 * still on air. The names are saved; the toggles act on the press.
 *
 * The two straps move differently -- one slides in from the edge of the screen, the
 * other fades -- which lives in the graphic, not here. A button does not know how
 * the thing it shows arrives.
 */
export default function LowerThirds() {
  return (
    <Panel title="Lower thirds">
      <Third which="one" label="Host" name="Alex Morgan" tag="@morgs" />
      {/* Below 1024px each strap is two or three lines, and the two run together
          without a line between them. */}
      <hr className="border-slate-800 lg:hidden" />
      <Third which="two" label="Guest" name="Sam Okafor" tag="@samokay" />
    </Panel>
  )
}
