import Match from './panels/Match'
import Scores from './panels/Scores'

// The operator's board: which panels it has, and in what order.
//
// Panels live in ./panels, one per file. Add one there and list it here.
//
// Buttons write immediately. Anything you type stages until you save, so a
// half-typed name never reaches air -- the save button and Ctrl+S are already on the
// page, alongside the image store and the browser-source URLs to paste into OBS.
//
// To change several things with one click, write a mutation in
// src/mutations/custom.js and dispatch it:
//
//   const mutate = useVelcroMutate()
//
//   <button onClick={() => mutate('my:example', { team: 'home' })}>Big play</button>
export default function Control() {
  return (
    <>
      <Scores />
      <Match />
    </>
  )
}
