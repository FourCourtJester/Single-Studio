import { useRef } from 'react'

import { useTimer } from '../../hooks/useTimer'
import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { untilClockTime } from '../../toolkits/time'
import { cx } from '../../toolkits/cx'

/**
 * Count down to a wall-clock time rather than for a duration.
 *
 * "We go live at 19:00" is a different question from "five more minutes", and it is
 * the one a pre-show countdown actually asks. `as="time"` takes `HH:MM` and rolls
 * to tomorrow if that time has already passed today; `as="datetime-local"` takes a
 * full date for something further out.
 *
 * The operator's raw entry is stored alongside the target so the field repopulates
 * after a reload — someone returning to the board mid-show should see what they
 * typed, not an empty input under a running clock.
 */
export function Countdown({ name, label = 'Countdown', as = 'time', namespace = 'timers', className, ...rest }) {
  const path = `${namespace}.${name}`
  const { active, text, input } = useTimer(path)
  const mutate = useVelcroMutate()
  const ref = useRef(null)

  const start = () => {
    const raw = ref.current?.value

    if (!raw) return

    const at = as === 'time' ? Date.now() + untilClockTime(raw) : new Date(raw).getTime()

    // A target in the past clears rather than starting a countdown that is
    // instantly over. The mutation enforces this too; bailing here keeps the
    // operator's entry in the field so they can correct it.
    if (!Number.isFinite(at) || at <= Date.now()) return

    mutate('timer', { [path]: { at, input: raw } })
  }

  const stop = () => mutate('timer', { [path]: 0 })

  if (active) {
    return (
      <button
        type="button"
        onClick={stop}
        title={`Stop ${label}`}
        className={cx(
          'ss-countdown rounded-md bg-rose-600 px-3 py-2 text-sm font-medium tabular-nums text-white transition-colors hover:bg-rose-500',
          className,
        )}
        {...rest}
      >
        {label} &middot; {text}
      </button>
    )
  }

  return (
    <div className={cx('ss-countdown flex flex-col gap-1', className)} {...rest}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex items-stretch gap-2">
        <input
          ref={ref}
          type={as}
          defaultValue={input ?? ''}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            start()
          }}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition-colors focus:border-sky-500"
        />
        <button type="button" onClick={start} className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500">
          Start
        </button>
      </div>
    </div>
  )
}
