import {
  AssetLibrary,
  Break,
  ColorPicker,
  Countdown,
  Cycle,
  Field,
  ImagePicker,
  ImageSelect,
  Leaderboard,
  Operator,
  Panel,
  RelayAdmin,
  ResetButton,
  Stepper,
  Stopwatch,
  SwapButton,
  TimerButton,
  ToggleButton,
  useVelcroMutate,
} from '@single-studio/core'

import { ARMY_SIZE, COMMANDERS, FACTIONS, MAPS, UNITS } from '../roster'

// The operator's board.
//
// Plain composition: every control is bound to a path and knows nothing about any
// other. Buttons write immediately; anything you type into stages until you save
// (the save button, or Ctrl+S, lives on the control page itself).

/** One player's draft. Same controls both sides, so the board reads symmetrically. */
function Draft({ side, title }) {
  return (
    <Panel title={title}>
      <Field name={`${side}.name`} label={title} placeholder={side === 'home' ? 'Kestrel Corps' : 'Redline'} />
      <Stepper name={`${side}.score`} label={`${title} score`} />
      <Break />
      {/* Picked by picture rather than by name -- inside a draft timer nobody is
          reading a dropdown. */}
      <ImageSelect name={`${side}.faction`} label="Faction" options={FACTIONS} />
      <ImageSelect name={`${side}.commander`} label="Commander" options={COMMANDERS} />
      <ImageSelect name={`${side}.army`} label="Army" options={UNITS} multiple max={ARMY_SIZE} size="sm" />
      <ResetButton label="draft" paths={[`variables.${side}.faction`, `variables.${side}.commander`, `variables.${side}.army`]} />
    </Panel>
  )
}

export default function Control() {
  const mutate = useVelcroMutate()

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Match">
        <Cycle name="period" label="Game" choices={['Game 1', 'Game 2', 'Game 3', 'Tiebreak']} />
        <SwapButton label="Swap sides" paths={['variables.home.name', 'variables.home.score', 'variables.away.score', 'variables.away.name']} />
        <button
          type="button"
          onClick={() => mutate('demo:reset')}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
        >
          Reset scores
        </button>
        <button
          type="button"
          onClick={() => mutate('demo:next-game')}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
        >
          Next game (studio mutation)
        </button>
        <Break />
        <ImageSelect name="map" label="Map" options={MAPS} />
        <Break />
        {/* The scene's own blocks, each on its own switch. */}
        <ToggleButton name="map" label="map" />
        <ToggleButton name="armies" label="armies" />
        <ToggleButton name="elapsed" label="elapsed" />
        <ToggleButton name="showtime" label="pre-show" />
      </Panel>

      <Draft side="home" title="Home" />
      <Draft side="away" title="Away" />

      <Panel title="Clocks">
        {/* All three kinds, side by side. The round timer takes a typed duration --
            seconds or m:ss -- because five minutes is a guess about someone else's
            show. Pass `duration` instead to make it a one-press preset. */}
        <TimerButton name="round" label="Round" placeholder="5:00" />
        <Countdown name="showtime" label="Doors open" as="time" />
        <Stopwatch name="match" label="Show elapsed" />
      </Panel>

      <Panel title="Lower third">
        <Field name="lowerthird.title" label="Title" placeholder="Player name" />
        <Field name="lowerthird.subtitle" label="Subtitle" placeholder="Team / role" />
        <ToggleButton name="lowerthird" label="lower third" />
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
        <Field name="guest.name" label="Guest name" placeholder="Guest" />
        <Field name="guest.title" label="Role" placeholder="Analyst" />
        <ToggleButton name="guest" label="guest" />
      </Panel>

      <Panel title="Sponsor">
        <ImagePicker name="sponsor.url" label="Logo" />
        <Field name="sponsor.name" label="Sponsor name" placeholder="Acme" />
        {/* The accent reaches the scene as a CSS custom property, so a colour the
            operator picks drives anything the stylesheet can express. */}
        <ColorPicker name="sponsor.color" label="Accent" fallback="#f59e0b" presets={['#f59e0b', '#0ea5e9', '#e11d48', '#22c55e', '#a855f7', '#f8fafc']} />
        <ToggleButton name="sponsor" label="sponsor" />
      </Panel>

      <Panel title="Operators">
        {/* Presence needs a name to show. Local to the machine, not part of the
            show -- see the note in Operator. */}
        <Operator />
        {/* Renders nothing unless a relay is configured. Invite, and remove --
            removing somebody mid-show must not need a redeploy. */}
        <RelayAdmin />
      </Panel>

      <Panel title="Ticker">
        <Field name="ticker" label="Crawl text" as="textarea" rows={2} className="basis-full" />
      </Panel>

      <Panel title="Images">
        {/* The manager, inline. The same component opens as a modal from any picker. */}
        <AssetLibrary />
      </Panel>
    </div>
  )
}
