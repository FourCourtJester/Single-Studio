import { Panel, ResetButton, Select } from '@single-studio/core/control'

export default function Match() {
  return (
    <Panel title="Match">
      <Select name="period" label="Period" options={['1st', '2nd', '3rd', 'OT']} />
      <ResetButton label="scores" names={['home.score', 'away.score']} />
    </Panel>
  )
}
