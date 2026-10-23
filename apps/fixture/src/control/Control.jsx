import { useId, useState } from 'react'

import { useVelcroMutate } from '@single-studio/core'
import {
  AssetLibrary,
  Chevron,
  ColorPicker,
  Confirm,
  Countdown,
  CountdownTo,
  Cycle,
  Field,
  ImagePicker,
  ImageSelect,
  Leaderboard,
  Panel,
  ResetButton,
  Row,
  Stepper,
  Stopwatch,
  SwapButton,
  TextArea,
  Toggle,
  useCollapsed,
} from '@single-studio/core/control'

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
      <Row>
        <Field name={`${side}.name`} label={title} placeholder={side === 'home' ? 'Kestrel Corps' : 'Redline'} className="md:col-span-8" />
        <Stepper name={`${side}.score`} label={`${title} score`} className="md:col-span-4" />
      </Row>
      {/* Picked by picture rather than by name -- inside a draft timer nobody is
          reading a dropdown. */}
      <Row>
        <ImageSelect name={`${side}.faction`} label="Faction" options={FACTIONS} />
        <ImageSelect name={`${side}.commander`} label="Commander" options={COMMANDERS} />
        <ImageSelect name={`${side}.army`} label="Army" options={UNITS} multiple max={ARMY_SIZE} size="sm" />
      </Row>
      <ResetButton label="draft" names={[`${side}.faction`, `${side}.commander`, `${side}.army`]} />
    </Panel>
  )
}

/**
 * The three shapes a Panel's header takes. Kept to plain inputs and local state,
 * nothing bound to the show, so folding and pressing here leave the show exactly
 * as the checks around them expect it.
 */
/** A card folded the way a Panel folds, with core's own hook and chevron. */
function Card() {
  const [collapsed, toggle] = useCollapsed()
  const body = useId()

  return (
    <div className="fixture-card rounded-md border border-slate-800 p-2">
      <button type="button" onClick={toggle} aria-expanded={!collapsed} aria-controls={body} className="fixture-card-fold flex items-center gap-2 text-sm">
        <Chevron collapsed={collapsed} />
        Card
      </button>
      <p id={body} hidden={collapsed} className="fixture-card-body mt-2 text-sm text-slate-400">
        Folded by useCollapsed.
      </p>
    </div>
  )
}

function Folding() {
  const [presses, setPresses] = useState(0)
  const [small, setSmall] = useState(false)
  const press = 'rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200'

  return (
    <>
      {/* Folded on load, with actions that read the fold and one that counts its
          presses, folded or not. The title is long enough that a slim dock has to
          put the actions on a line of their own; the e2e suite measures that. */}
      <Panel
        title="Folding, with actions on its line"
        collapsible
        className="fixture-fold"
        actions={({ open }) => (
          <>
            <span className="fixture-fold-says text-xs text-slate-500">{open ? 'open' : 'folded'}</span>
            <button type="button" onClick={() => setPresses((n) => n + 1)} className={`fixture-fold-press ${press}`}>
              Pressed {presses}
            </button>
          </>
        )}
      >
        <input aria-label="Kept while folded" className="fixture-fold-input rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
      </Panel>

      {/* No title: actions keep their line, and the fold is a chevron of its own. */}
      <Panel
        collapsible
        defaultOpen
        className="fixture-untitled"
        actions={
          <button type="button" className={`fixture-untitled-action ${press}`}>
            Untitled action
          </button>
        }
      >
        <p className="text-sm text-slate-400">No title; starts open.</p>
        <Card />
        {/* A stepper at its own width beside a field taking the rest: `col-auto` still
            means 160px now that a stepper grows into any other cell. Measured, never
            pressed or typed into. */}
        <Row className="fixture-auto">
          <Stepper name="fixture.auto" label="At its own width" className="col-auto" />
          <Field name="fixture.beside" label="The rest" />
        </Row>
      </Panel>

      <Panel title="Picker width">
        {/* A picker at its own width from 640px, beside the field that used to lose:
          with a long name in the library it stops at --ss-picker-max rather than
          leaving the field 25px. Below 640px it has the line to itself. */}
        <Row className="fixture-capped">
          <ImagePicker name="fixture.logo" label="Crest" className="sm:col-auto" />
          <Field name="fixture.team" label="Team name" />
        </Row>
      </Panel>

      {/* Every header button at size="sm", both ways a reset and a swap render, beside
          the same reset at its own size on a Row. Mounted only when the e2e suite asks,
          because checks long before it find the board's one swap and one reset by
          class. Bound to paths nothing else reads, and only measured, never pressed. */}
      <Panel
        title="Header buttons"
        className="fixture-small"
        actions={
          small ? (
            <>
              <Confirm size="sm" label="Confirm" onConfirm={() => {}} />
              <ResetButton size="sm" label="nothing" names={['fixture.nothing']} />
              <ResetButton size="sm" label="at once" names={['fixture.nothing']} confirm={false} />
              <SwapButton size="sm" label="nothing" names={['fixture.left', 'fixture.right']} />
              <SwapButton size="sm" label="at once" names={['fixture.left', 'fixture.right']} confirm={false} />
              <Toggle size="sm" name="fixture-small" label="small" />
              {/* Squeezed the way a studio might, to fit one more in: the size keeps a
                  floor under it however its padding is cut. */}
              <Toggle size="sm" name="fixture-small" label="squeezed" style={{ paddingBlock: 0 }} />
            </>
          ) : null
        }
      >
        <button type="button" onClick={() => setSmall((was) => !was)} className={`fixture-small-mount ${press}`}>
          {small ? 'Unmount' : 'Mount'} header buttons
        </button>
        {small ? (
          <Row>
            <ResetButton label="nothing" names={['fixture.nothing']} className="fixture-small-md" />
          </Row>
        ) : null}
      </Panel>

      {/* Nothing for a header to hold, so no header. */}
      <Panel className="fixture-bare">
        <p className="text-sm text-slate-400">No title, no actions.</p>
      </Panel>
    </>
  )
}

export default function Control() {
  const mutate = useVelcroMutate()

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Match">
        {/* Five in a row, left to share the line: five equal widths. The e2e suite
            measures that. */}
        <Row>
          <Cycle name="period" label="Game" options={['Game 1', 'Game 2', 'Game 3', 'Tiebreak']} />
          <SwapButton label="Swap sides" names={['home.name', 'home.score', 'away.name', 'away.score']} />
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
          <button
            type="button"
            onClick={() => mutate('demo:fumble')}
            className="fixture-fumble rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
          >
            Fumble (fails on purpose)
          </button>
        </Row>
        <ImageSelect name="map" label="Map" options={MAPS} />
        {/* The scene's own blocks, each on its own switch. */}
        <Row>
          <Toggle name="map" label="map" />
          <Toggle name="armies" label="armies" />
          <Toggle name="elapsed" label="elapsed" />
          <Toggle name="showtime" label="pre-show" />
        </Row>
      </Panel>

      <Draft side="home" title="Home" />
      <Draft side="away" title="Away" />

      {/* Both shapes of a count said in icons. Objectives is a plain count -- three
          taken is three marks, nothing at zero. The series is a race: as many marks
          as it takes to win it, the won ones filled. */}
      <Panel title="Tallies">
        <Cycle name="series" label="Games to win" options={['1', '2', '3', '4']} />
        <Row>
          <Stepper name="home.objectives" label="Home objectives" />
          <Stepper name="away.objectives" label="Away objectives" />
        </Row>
        <Row>
          <Stepper name="home.games" label="Home games" />
          <Stepper name="away.games" label="Away games" />
        </Row>
      </Panel>

      <Panel title="Clocks">
        {/* All three kinds, side by side. The round timer takes a typed duration --
            seconds or m:ss -- because five minutes is a guess about someone else's
            show. Pass `duration` instead to make it a one-press preset. */}
        <Row>
          <Countdown name="round" label="Round" placeholder="5:00" />
          <CountdownTo name="showtime" label="Doors open" />
          <Stopwatch name="match" label="Show elapsed" />
        </Row>
      </Panel>

      <Panel title="Lower third">
        {/* A switch beside two labelled fields: it drops a label line to sit level
            with their inputs. The e2e suite measures that. */}
        <Row>
          <Field name="lowerthird.title" label="Title" placeholder="Player name" />
          <Field name="lowerthird.subtitle" label="Subtitle" placeholder="Team / role" />
          <Toggle name="lowerthird" label="lower third" />
        </Row>
      </Panel>

      <Panel title="Standings">
        <Row>
          <Field name="standings.title" label="Heading" placeholder="Standings" className="md:col-span-8" />
          <Toggle name="standings" label="standings" className="md:col-span-4" />
        </Row>
        <Leaderboard name="standings" label="Board" fields={['name', 'score']} rows={5} />
      </Panel>

      <Panel title="Guest">
        {/* A headshot that arrives minutes before air: drop it in, it goes to the
            local store, and the path is staged until save like any other field.

            The row that changes shape more than once: one to a line in a dock, two
            from 640px, all four from 1024px with the switch at its own width and the
            fields taking the rest. The e2e suite measures each. */}
        <Row className="sm:row-cols-2 lg:row-cols-4">
          <ImagePicker name="guest.photo" label="Headshot" />
          <Field name="guest.name" label="Guest name" placeholder="Guest" />
          <Field name="guest.title" label="Role" placeholder="Analyst" />
          <Toggle name="guest" label="guest" className="lg:col-auto" />
        </Row>
      </Panel>

      <Panel title="Sponsor">
        <Row>
          <ImagePicker name="sponsor.url" label="Logo" />
          <Field name="sponsor.name" label="Sponsor name" placeholder="Acme" />
          {/* The accent reaches the scene as a CSS custom property, so a colour the
            operator picks drives anything the stylesheet can express. */}
          <ColorPicker name="sponsor.color" label="Accent" fallback="#f59e0b" presets={['#f59e0b', '#0ea5e9', '#e11d48', '#22c55e', '#a855f7', '#f8fafc']} />
          <Toggle name="sponsor" label="sponsor" />
        </Row>
      </Panel>

      <Panel title="Ticker">
        <TextArea name="ticker" label="Crawl text" rows={2} />
      </Panel>

      {/* Starts the intro sequence on #/source/sequence. */}
      <Panel title="Sequence">
        <Toggle name="intro" label="intro" />
      </Panel>

      <Folding />

      <Panel title="Images">
        {/* The manager, inline. The same component opens as a modal from any picker. */}
        <AssetLibrary />
      </Panel>
    </div>
  )
}
