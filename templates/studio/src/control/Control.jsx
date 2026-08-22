import { Break, Field, Panel, ResetButton, Select, Stepper, SwapButton } from '@single-studio/core'

// Your operator's board. Every control binds to a path and knows nothing about any
// other, so this file is plain composition -- add a control, bind it, done.
//
// Buttons write immediately. Anything you *type* into stages until you save, so a
// half-typed name never reaches air; the save button and Ctrl+S are on the page
// already. The header also carries the collaboration light, the image store and
// the list of browser-source URLs to paste into OBS.
export default function Control() {
  return (
    <Panel title="Scores">
      <Field name="home.name" label="Home" placeholder="Home team" />
      <Stepper name="home.score" label="Home score" />
      <Stepper name="away.score" label="Away score" />
      <Field name="away.name" label="Away" placeholder="Away team" />
      <SwapButton label="sides" names={['home.name', 'home.score', 'away.score', 'away.name']} />
      <Break />
      <Select name="period" label="Period" options={['1st', '2nd', '3rd', 'OT']} />
      <ResetButton label="scores" names={['home.score', 'away.score']} />
    </Panel>
  )
}
