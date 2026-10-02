import { useVelcroValue } from '@single-studio/core'
import { Clock as WallClock, Scene, Toggle } from '@single-studio/core/source'

/** What the board's Format control stores, as what `Intl.DateTimeFormat` takes. */
const FORMATS = {
  '24-hour': { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  '12-hour': { hour: 'numeric', minute: '2-digit', hour12: true },
}

/**
 * Unset: the locale's own way of writing the time, so the default is right wherever
 * this is shown. A constant rather than written inline, because `Clock` restarts its
 * tick whenever `options` is a different object, and an inline one is new every render.
 */
const LOCAL = { hour: 'numeric', minute: '2-digit' }

/**
 * The time, in the corner. `#/source/clock` in OBS.
 *
 * Top right, the one corner nothing else claims. It reads the clock of the machine
 * drawing it -- the one running OBS -- so it shows the studio's local time, which is
 * what a time of day in the corner of a stream means.
 */
export default function Clock() {
  const format = useVelcroValue('variables.clock.format', '')

  return (
    <Scene className="flex items-start justify-end p-8">
      <Toggle name="clock" transition="slide-down ease-out">
        <div className="rounded-lg bg-slate-950/90 px-4 py-2 text-white shadow-2xl ring-1 ring-white/10">
          <WallClock options={FORMATS[format] ?? LOCAL} className="text-2xl font-semibold tabular-nums" />
        </div>
      </Toggle>
    </Scene>
  )
}
