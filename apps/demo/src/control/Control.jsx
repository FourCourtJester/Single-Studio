import {
  Break,
  Countdown,
  Cycle,
  AssetLibrary,
  Field,
  ImagePicker,
  Leaderboard,
  Panel,
  ResetButton,
  Select,
  Stepper,
  SwapButton,
  TimerButton,
  ToggleButton,
  useVelcroMutate,
} from '@single-studio/core'

// The operator's board. Plain composition -- every control is bound to a path,
// and there is no save button because writes land as you type.
export default function Control() {
  const mutate = useVelcroMutate()

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Teams">
        <Field name="home.name" label="Home" placeholder="Broncos" />
        <Stepper name="home.score" label="Home score" />
        <Stepper name="away.score" label="Away score" />
        <Field name="away.name" label="Away" placeholder="Vandals" />
        <SwapButton label="Swap ends" paths={['variables.home.name', 'variables.home.score', 'variables.away.score', 'variables.away.name']} />
        <Break />
        <Select name="sport" label="Sport" options={['Rocket League', 'Valorant', 'Overwatch']} />
        <Cycle name="period" label="Period" choices={['1st', '2nd', '3rd', 'OT']} />
        <ResetButton label="scores" paths={['variables.home.score', 'variables.away.score']} />
      </Panel>

      <Panel title="Lower third">
        <Field name="lowerthird.title" label="Title" placeholder="Player name" />
        <Field name="lowerthird.subtitle" label="Subtitle" placeholder="Position" />
        <ToggleButton name="lowerthird" label="lower third" />
      </Panel>

      <Panel title="Clocks">
        <TimerButton name="break" label="break" duration="5:00" />
        {/* Counts down to a wall-clock time, not a duration -- "we go live at 19:00". */}
        <Countdown name="showtime" label="Show starts" as="time" />
      </Panel>

      <Panel title="Standings">
        <Field name="standings.title" label="Heading" placeholder="Standings" />
        <ToggleButton name="standings" label="standings" />
        <Break />
        <Leaderboard name="standings" label="Board" fields={['name', 'score']} rows={5} />
      </Panel>

      <Panel title="Guest">
        {/* A headshot that arrives minutes before air: drop it in, it goes to the
            local store, and the path is staged until save like any other field. */}
        <ImagePicker name="guest.photo" label="Headshot" />
        <Field name="guest.name" label="Name" placeholder="Guest" />
        <Field name="guest.title" label="Title" placeholder="Author" />
        <ToggleButton name="guest" label="guest" />
      </Panel>

      <Panel title="Images">
        {/* The manager, inline. The same component opens as a modal from any picker. */}
        <AssetLibrary />
      </Panel>

      <Panel title="Sponsor">
        <ImagePicker name="sponsor.url" label="Logo" />
        <Field name="sponsor.name" label="Name" placeholder="Acme" />
        <Field name="sponsor.color" label="Accent" placeholder="#f59e0b" />
        <ToggleButton name="sponsor" label="sponsor" />
      </Panel>

      <Panel title="Ticker">
        <Field name="ticker" label="Crawl text" as="textarea" rows={2} className="basis-full" />
      </Panel>

      <Panel title="Match">
        <button
          type="button"
          onClick={() => mutate('demo:reset')}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
        >
          Reset match
        </button>
        <button
          type="button"
          onClick={() => mutate('demo:swap-ends')}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
        >
          Swap ends (studio mutation)
        </button>
      </Panel>
    </div>
  )
}
