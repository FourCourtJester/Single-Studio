import { Image, ImageList, Scene, Timer, Toggle, Variable, useVelcroValue } from '@single-studio/core'

import { ARMY_SIZE, COMMANDERS, MAPS, labelOf } from '../roster'

/**
 * Add to OBS as a Browser source pointed at #/source/match
 *
 * The whole show in one scene, the way a small esports broadcast actually runs it:
 * one browser source, everything inside it toggled on and off by the operator.
 *
 * Every path here is templated rather than mapped. The control writes a slug --
 * `vanguard`, `battle-tank` -- and the scene turns it into `./factions/vanguard.svg`,
 * so adding a faction is a file and a line in roster.js, never a change here.
 *
 * All three clocks appear at once because they answer different questions:
 *   timers.showtime  counts down to a wall-clock time  ("live at 19:00")
 *   timers.round     counts down a duration            ("five minute round")
 *   timers.match     counts up from a start            ("we are 42 minutes in")
 *
 * Every block moves differently on purpose. The state machine is the same one in
 * all of them -- it sets three phase classes and never touches a transform -- so a
 * wipe, a bounce and an overshooting slide are `transition="..."` and nothing else.
 */

function Side({ side, accent }) {
  return (
    <div className={`flex flex-col gap-2 ${side === 'home' ? 'items-start' : 'items-end'}`}>
      <div className={`flex items-center gap-3 ${side === 'away' ? 'flex-row-reverse' : ''}`}>
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/5 p-1">
          <Image name={`${side}.faction`} src="./factions/:value:.svg" transition="wipe ease-sharp" alt="" />
        </div>
        <div className={`flex flex-col ${side === 'away' ? 'items-end' : ''}`}>
          <span className="text-2xl font-semibold uppercase tracking-wide text-white">
            <Variable name={`${side}.name`} fallback={side === 'home' ? 'Home' : 'Away'} transition="flip ease-sharp" fit />
          </span>
          <span className={`text-xs uppercase tracking-widest ${accent}`}>
            <Commander side={side} />
          </span>
        </div>
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white/5">
          <Image name={`${side}.commander`} src="./commanders/:value:.svg" transition="zoom ease-back" alt="" />
        </div>
      </div>

      <Toggle name="armies" transition="slide-up ease-back" style={{ '--ss-shift': '1.75rem', '--ss-duration': '420ms' }}>
        <ImageList
          name={`${side}.army`}
          src="./units/:value:.svg"
          limit={ARMY_SIZE}
          className={side === 'away' ? 'flex-row-reverse' : ''}
          itemClassName="h-10 w-10 rounded bg-white/5 p-0.5"
        />
      </Toggle>
    </div>
  )
}

/** The stored value is a slug; the caption wants the name it was picked by. */
function Commander({ side }) {
  const value = useVelcroValue(`variables.${side}.commander`, '')

  return labelOf(COMMANDERS, value) || ' '
}

function MapCard() {
  const value = useVelcroValue('variables.map', '')

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-950/90 p-2 ring-1 ring-white/10">
      <div className="h-24 w-24">
        <Image name="map" src="./maps/:value:.svg" alt="" />
      </div>
      <span className="text-[10px] uppercase tracking-widest text-slate-400">{labelOf(MAPS, value) || 'No map'}</span>
    </div>
  )
}

export default function Match() {
  return (
    <Scene className="match flex flex-col justify-between p-10">
      <div className="flex items-start justify-between gap-8">
        <Side side="home" accent="text-sky-400" />

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-stretch overflow-hidden rounded-lg bg-slate-950/90 text-white shadow-2xl ring-1 ring-white/10">
            <div className="flex w-20 items-center justify-center bg-sky-600 text-4xl font-bold tabular-nums">
              <Variable name="home.score" fallback="0" transition="slide-up ease-back" />
            </div>
            <div className="flex w-28 flex-col items-center justify-center px-2 py-1">
              <span className="text-[10px] uppercase tracking-widest text-slate-400">
                <Variable name="period" fallback="Game 1" transition="wipe ease-sharp" />
              </span>
              {/* Duration countdown -- the round clock. */}
              <Timer name="round" fallback="--:--" className="text-lg font-semibold" />
            </div>
            <div className="flex w-20 items-center justify-center bg-rose-600 text-4xl font-bold tabular-nums">
              <Variable name="away.score" fallback="0" transition="slide-down ease-back" />
            </div>
          </div>

          {/* Count-up -- how long the show has been running. Same component, and it
              never had to be told which kind of clock it was reading. */}
          <Toggle name="elapsed" transition="slide-down ease-out" style={{ '--ss-shift': '1rem' }}>
            <span className="rounded bg-slate-950/80 px-2 py-0.5 text-xs uppercase tracking-widest text-slate-300 ring-1 ring-white/10">
              Elapsed <Timer name="match" fallback="00:00" className="inline font-semibold tabular-nums text-white" />
            </span>
          </Toggle>
        </div>

        <Side side="away" accent="text-rose-400" />
      </div>

      {/*
        Each block down here is pinned rather than laid out in a row. A reveal must
        not move its neighbours: on air, the map card sliding in while the lower
        third jumps sideways to make room reads as a bug, not as a transition.

        Note the centred block is centred by a wrapper, not by a translate class on
        the Toggle itself. A transform-based centering would be overwritten the
        moment a variant animates transform -- which is exactly what bounce does.
      */}
      <div className="pointer-events-none absolute inset-x-10 bottom-10 h-40">
        <Toggle
          name="map"
          transition="slide-right ease-out opaque"
          className="absolute bottom-0 left-0"
          style={{ '--ss-shift': '12rem', '--ss-duration': '450ms' }}
        >
          <MapCard />
        </Toggle>

        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          {/* Countdown to a wall-clock time -- the pre-show card, and the one
              keyframe variant: it drops in and settles twice. */}
          <Toggle name="showtime" transition="bounce" style={{ '--ss-duration': '900ms', '--ss-drop': '4rem' }}>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-950/90 px-8 py-4 ring-1 ring-white/10">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Starting in</span>
              <Timer name="showtime" fallback="soon" className="text-5xl font-bold tabular-nums text-white" />
            </div>
          </Toggle>
        </div>

        <Toggle
          name="lowerthird"
          transition="slide-left ease-back opaque"
          className="absolute bottom-0 right-0"
          style={{ '--ss-shift': '32rem', '--ss-duration': '520ms' }}
        >
          <div className="flex flex-col rounded-lg bg-slate-950/90 px-6 py-3 text-white ring-1 ring-white/10">
            <span className="text-xl font-semibold">
              <Variable name="lowerthird.title" fallback="Title" />
            </span>
            <span className="text-sm text-slate-400">
              <Variable name="lowerthird.subtitle" fallback="Subtitle" />
            </span>
          </div>
        </Toggle>
      </div>
    </Scene>
  )
}
