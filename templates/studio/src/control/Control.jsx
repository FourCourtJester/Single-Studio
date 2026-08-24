import { Break, Field, Panel, ResetButton, Select, Stepper, SwapButton } from '@single-studio/core'

// Your operator's board. Every control binds to a path and knows nothing about any
// other, so this file is plain composition -- add a control, bind it, done.
//
// Buttons write immediately. Anything you *type* into stages until you save, so a
// half-typed name never reaches air; the save button and Ctrl+S are on the page
// already. The header also carries the collaboration light, the image store and
// the list of browser-source URLs to paste into OBS.
//
// When one button has to change several things at once -- credit a basket, stop
// the clock and light a graphic -- that is a mutation rather than three writes.
// There is a no-op waiting in src/mutations/custom.js to fill in, and this is how
// you would reach it:
//
//   import { useVelcroMutate } from '@single-studio/core'
//
//   const mutate = useVelcroMutate()
//
//   <button onClick={() => mutate('my:example', { team: 'home' })}>Big play</button>
//
// One mutation is one change on air. Two `mutate` calls from one click are two,
// and the graphics will show the gap between them.
export default function Control() {
  return (
    <Panel title="Scores">
      <Field name="home.name" label="Home" placeholder="Home team" />
      <Stepper name="home.score" label="Home score" />
      <Stepper name="away.score" label="Away score" />
      <Field name="away.name" label="Away" placeholder="Away team" />
      <SwapButton label="sides" names={['home.name', 'home.score', 'away.name', 'away.score']} />
      <Break />
      <Select name="period" label="Period" options={['1st', '2nd', '3rd', 'OT']} />
      <ResetButton label="scores" names={['home.score', 'away.score']} />
    </Panel>
  )
}
