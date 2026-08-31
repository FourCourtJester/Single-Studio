// YOURS — the operator's board.
import Match from './panels/Match'
import Scores from './panels/Scores'

// Your operator's board: which panels it has, and in what order.
//
// Panels live in ./panels, one per file, and this composes them. They are listed
// here rather than found by a glob because the order is a decision -- what an
// operator reaches for most belongs at the top, and alphabetical is not that.
//
// Buttons write immediately. Anything you *type* stages until you save, so a
// half-typed name never reaches air; the save button and Ctrl+S are already on the
// page. The header carries the collaboration light, the image store, and the list
// of browser-source URLs to paste into OBS.
//
// When one button has to change several things at once -- credit a basket, stop the
// clock and light a graphic -- that is a mutation rather than three writes. There is
// a no-op waiting in src/mutations/custom.js, reached like this:
//
//   import { useVelcroMutate } from '@single-studio/core'
//
//   const mutate = useVelcroMutate()
//
//   <button onClick={() => mutate('my:example', { team: 'home' })}>Big play</button>
//
// One mutation is one change on air. Two `mutate` calls from one click are two, and
// the graphics will show the gap between them.
export default function Control() {
  return (
    <>
      <Scores />
      <Match />
    </>
  )
}
