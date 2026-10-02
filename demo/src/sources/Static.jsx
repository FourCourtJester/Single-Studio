import { useVelcroValue } from '@single-studio/core'
import { Scene, Slideshow, Ticker, Timer, Toggle, Variable } from '@single-studio/core/source'

/**
 * One of the three clocks, in the space they share.
 *
 * All three sit in the same grid cell, so swapping one for another is one leaving
 * while the next arrives in the same place, rather than the card reflowing.
 */
function Clock({ name, label, transition }) {
  return (
    <Toggle name={`static.${name}`} transition={transition} className="col-start-1 row-start-1">
      <div className="text-center">
        <div className="text-sm font-medium uppercase tracking-[0.3em] text-sky-400">{label}</div>
        <Timer name={`static.${name}`} as="div" fallback="0:00" className="mt-2 text-8xl font-bold tabular-nums data-[over]:text-rose-400" />
      </div>
    </Toggle>
  )
}

/**
 * The holding card, for before the show and the breaks. `#/source/static` in OBS.
 *
 * Full screen, so it is its own scene rather than a layer on the others.
 *
 * Behind it, `Slideshow` plays whatever an operator dropped into the `static` group
 * of the image library -- nothing here lists the pictures, so dressing the card is
 * dropping a folder on the board rather than a redeploy. Which picture is up comes
 * off the clock, so a second machine opening this mid-show lands on the same one.
 *
 * The clocks store an instant rather than a number of seconds left, so nothing ticks
 * and nothing drifts: every output derives the same time from the same timestamp,
 * and a card opened with two minutes to go joins at two minutes.
 */
export default function Static() {
  // Only read to decide whether the ticker's bar is drawn at all. An empty bar along
  // the bottom of the screen looks like something failed to load.
  const ticker = useVelcroValue('variables.static.ticker', '')

  return (
    <Scene className="relative overflow-hidden bg-slate-950 text-white">
      <Slideshow group="static" every={9} order="shuffle" className="absolute inset-0" fit="cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/60 to-sky-950/80" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 px-24">
        <div className="w-full max-w-5xl text-center text-6xl font-bold">
          <Variable name="static.message" fallback="Back shortly" fit transition="zoom ease-out" />
        </div>

        <div className="grid">
          <Clock name="countdown" label="Back in" transition="zoom ease-back" />
          <Clock name="until" label="Starting in" transition="slide-up ease-out" />
          <Clock name="stopwatch" label="Running for" transition="flip ease-out" />
        </div>
      </div>

      {ticker ? (
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/90 py-3 text-xl text-slate-200">
          <Ticker name="static.ticker" speed={90} />
        </div>
      ) : null}
    </Scene>
  )
}
