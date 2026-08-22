import { useRef } from 'react'

import { useTimer } from '../../hooks/useTimer'
import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { untilClockTime } from '../../toolkits/time'
import { cx } from '../../toolkits/cx'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'timers'

/**
 * @typedef {object} CountdownToProps
 * @property {string} name - Names a value under `timers` — e.g. `round`.
 * @property {string} [label] - Shown above the control. Defaults to `"Starts at"`.
 * @property {'time'|'datetime-local'} [as] - `"time"` takes HH:MM and rolls to tomorrow if past. Defaults to `"time"`.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Counts down to a time of day rather than a length — "we go live at 19:30".
 * Rolls to tomorrow if the time has already passed today.
 *
 * Named for what an operator types into it: `CountdownTo` takes 19:30, `Countdown`
 * takes 5:00. It was called `Countdown` and the duration one was called
 * `TimerButton`, so the common case had the unguessable name and somebody wanting a
 * five-minute break clock reached for this and got the wrong component.
 *
 * "We go live at 19:00" is a different question from "five more minutes", and it is
 * the one a pre-show countdown actually asks. `as="time"` takes `HH:MM` and rolls
 * to tomorrow if that time has already passed today; `as="datetime-local"` takes a
 * full date for something further out.
 *
 * The operator's raw entry is stored alongside the target so the field repopulates
 * after a reload — someone returning to the board mid-show should see what they
 * typed, not an empty input under a running clock.
 *
 * @example
 * <CountdownTo name="showtime" label="Doors open" />
 *
 * @example
 * // Something further out than today
 * <CountdownTo name="finals" label="Finals" as="datetime-local" />
 *
 * @param {CountdownToProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function CountdownTo({ name, label = 'Starts at', as = 'time', className, ...rest }) {
  const path = `${NAMESPACE}.${name}`
  const { active, text, input } = useTimer(path)
  const mutate = useVelcroMutate()
  const ref = useRef(null)

  const start = () => {
    const raw = ref.current?.value

    if (!raw) return

    // `HH:MM` is handed over as a *duration* rather than resolved to an epoch here,
    // and that is the skew-correct thing to do. The mutation runs in the worker,
    // where the room's clock is known; resolving it on this page would bake this
    // machine's idea of now into the target, so a board four seconds fast would put
    // a pre-show countdown four seconds late on the machine going to air. A full
    // date is genuinely absolute and needs no such help.
    const spec = as === 'time' ? { duration: untilClockTime(raw), input: raw } : { at: new Date(raw).getTime(), input: raw }
    const at = spec.at ?? Date.now() + spec.duration

    // A target in the past clears rather than starting a countdown that is
    // instantly over. The mutation enforces this too; bailing here keeps the
    // operator's entry in the field so they can correct it.
    if (!Number.isFinite(at) || at <= Date.now()) return

    mutate('timer', { [path]: spec })
  }

  const stop = () => mutate('timer', { [path]: 0 })

  if (active) {
    return (
      <button
        type="button"
        onClick={stop}
        title={`Stop ${label}`}
        className={cx(
          'ss-countdown-to rounded-md bg-rose-600 px-3 py-2 text-sm font-medium tabular-nums text-white transition-colors hover:bg-rose-500',
          className,
        )}
        {...rest}
      >
        {label} &middot; {text}
      </button>
    )
  }

  return (
    <div className={cx('ss-countdown-to flex flex-col gap-1', className)} {...rest}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {/* Joined into one control, like every other entry-then-go pair on the board. */}
      <div className="ss-input-group flex">
        <input
          ref={ref}
          type={as}
          defaultValue={input ?? ''}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            start()
          }}
          className="min-w-0 grow rounded-l-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition-colors focus:relative focus:border-sky-500"
        />
        <button
          type="button"
          onClick={start}
          className="-ml-px shrink-0 rounded-r-md border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-sky-500 hover:bg-sky-500 focus:relative"
        >
          Start
        </button>
      </div>
    </div>
  )
}
