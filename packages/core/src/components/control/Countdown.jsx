import { useRef } from 'react'

import { useTimer } from '../../hooks/useTimer'
import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { parseDuration } from '../../toolkits/time'
import { cx } from '../../toolkits/cx'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'timers'

/**
 * @typedef {object} CountdownProps
 * @property {string} name - Names a value under `timers` — e.g. `round`.
 * @property {string} [label] - Shown above the control, and on the running clock.
 * @property {string|number} [duration] - A fixed length, e.g. `"5:00"`. Without it the operator types one.
 * @property {string} [placeholder] - Hint in the duration field. Defaults to `"5:00"`.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Counts down a duration — a break, a half, a stinger. Without `duration` the
 * operator types one; with it the control is a single press. Writes immediately.
 *
 * Named for what an operator types into it: `Countdown` takes 5:00, `CountdownTo`
 * takes 19:30. This was `TimerButton`, which said nothing about which of the two it
 * was, while the wall-clock one held the name people reach for first.
 *
 * Two shapes, chosen by whether a `duration` is given.
 *
 * With one, it is a single button: a preset, for a break that is always the same
 * length. Without one, it grows an input, because a fixed five minutes is a
 * guess about somebody else's show. The input takes what an operator would
 * naturally type -- `90` for ninety seconds, `1:30`, or `1:02:03` -- rather than
 * insisting on a format, since the one thing nobody has mid-broadcast is the
 * patience to be corrected about punctuation.
 *
 * Either way the entry is stored alongside the target, so the field repopulates
 * after a reload instead of coming back empty under a running clock.
 *
 * @example
 * <Countdown name="round" label="Round" />
 *
 * @example
 * // Always the same length, so one press starts it
 * <Countdown name="break" label="break" duration="5:00" />
 *
 * @param {CountdownProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Countdown({ name, label, duration, placeholder = '5:00', className, ...rest }) {
  const path = `${NAMESPACE}.${name}`
  const { active, text, input } = useTimer(path)
  const mutate = useVelcroMutate()
  const ref = useRef(null)

  const stop = () => mutate('timer', { [path]: 0 })

  const start = (raw) => {
    const ms = parseDuration(raw)

    // Nothing usable typed. Bailing here leaves the entry in the field to be
    // corrected, rather than clearing it and making them start again.
    if (!ms) return

    mutate('timer', { [path]: { duration: ms, input: String(raw) } })
  }

  if (active) {
    return (
      <button
        type="button"
        onClick={stop}
        aria-label={`Stop ${label ?? name}`}
        className={cx(
          'ss-countdown rounded-md bg-rose-600 px-3 py-2 text-sm font-medium tabular-nums text-white transition-colors hover:bg-rose-500',
          className,
        )}
        {...rest}
      >
        Stop {text}
      </button>
    )
  }

  if (duration !== undefined) {
    return (
      <button
        type="button"
        onClick={() => start(duration)}
        className={cx(
          'ss-countdown rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium tabular-nums text-slate-200 transition-colors hover:border-slate-500',
          className,
        )}
        {...rest}
      >
        Start {label ?? name}
      </button>
    )
  }

  return (
    <div className={cx('ss-countdown flex flex-col gap-1', className)} {...rest}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label ?? name}</span>
      <div className="ss-input-group flex">
        <input
          ref={ref}
          defaultValue={input ?? ''}
          placeholder={placeholder}
          aria-label={`${label ?? name} duration`}
          spellCheck={false}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            start(ref.current?.value)
          }}
          className="min-w-0 grow rounded-l-md border border-slate-700 bg-slate-900 px-3 py-2 tabular-nums text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:relative focus:border-sky-500"
        />
        <button
          type="button"
          onClick={() => start(ref.current?.value)}
          className="-ml-px shrink-0 rounded-r-md border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-sky-500 hover:bg-sky-500 focus:relative"
        >
          Start
        </button>
      </div>
    </div>
  )
}
