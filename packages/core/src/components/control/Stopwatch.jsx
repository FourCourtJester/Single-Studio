import { useTimer } from '../../hooks/useTimer'
import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { cx } from '../../toolkits/cx'

/**
 * A count-up clock: start, pause, reset.
 *
 * The third of the three clocks. <Countdown> counts down a duration, <CountdownTo>
 * counts down to a wall-clock time, and this one counts up from the moment it was
 * started -- match length, segment length, "how long have we been on this map".
 *
 * Nothing here ticks. The mutation stores an origin and every peer derives the same
 * elapsed time from it, so a companion operator's stopwatch reads the same number as
 * the OBS machine's without either of them sending the other a single frame.
 */
export function Stopwatch({ name, label = 'Stopwatch', namespace = 'timers', className, ...rest }) {
  const path = `${namespace}.${name}`
  const { running, active, text } = useTimer(path)
  const mutate = useVelcroMutate()

  const send = (action) => mutate('stopwatch', { [path]: action })

  return (
    <div className={cx('ss-stopwatch flex flex-col gap-1', className)} {...rest}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {/* Wraps rather than overflows. Three controls have a natural width the panel
          knows nothing about, and at the one width where three clocks fit in a row
          and each is barely wide enough, Reset used to hang out past the panel's
          edge. A control that runs out of room should fold, not escape. */}
      <div className="flex flex-wrap items-stretch gap-2">
        <output className="flex min-w-[4.5rem] items-center justify-center rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm tabular-nums text-slate-100">
          {active ? text : '00:00'}
        </output>
        <button
          type="button"
          onClick={() => send(running ? 'pause' : 'start')}
          className={cx(
            'rounded-md px-3 py-2 text-sm font-medium text-white transition-colors',
            running ? 'bg-amber-600 hover:bg-amber-500' : 'bg-sky-600 hover:bg-sky-500',
          )}
        >
          {running ? 'Pause' : active ? 'Resume' : 'Start'}
        </button>
        <button
          type="button"
          onClick={() => send('reset')}
          disabled={!active}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 disabled:opacity-40 disabled:hover:border-slate-700"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
