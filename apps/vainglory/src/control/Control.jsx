import Match from './panels/Match'
import Standby from './panels/Standby'

// The operator's board. Buttons write immediately; anything typed stages until save
// (the save button and Ctrl+S are already on the page).
export default function Control() {
  return (
    <>
      <Match />
      <Standby />
    </>
  )
}
