import { useRef } from 'react'

import { useTimer } from '../../hooks/useTimer'
import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { parseDuration } from '../../toolkits/time'
import { cx } from '../../toolkits/cx'

/**
 * Count down for a duration.
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
 */
export function TimerButton({ name, label, duration, placeholder = '5:00', namespace = 'timers', className, ...rest }) {
  const path = `${namespace}.${name}`
  const { active, running, text, input } = useTimer(path)
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

  /**
   * A finished countdown is still a countdown, and still has to be takeable off air.
   *
   * The graphic rests on 00:00 now rather than removing itself -- see `Timer` --
   * which means the doc holds a target in the past and something has to be able to
   * clear it. Without this the only ways out were starting another one or resetting
   * the whole show, because the control went back to offering a fresh duration and
   * quietly stopped mentioning the clock that was on screen.
   */
  if (active) {
    return (
      <button
        type="button"
        onClick={stop}
        aria-label={`${running ? 'Stop' : 'Clear'} ${label ?? name}`}
        className={cx(
          'ss-timer-button rounded-md px-3 py-2 text-sm font-medium tabular-nums text-white transition-colors',
          running ? 'bg-rose-600 hover:bg-rose-500' : 'bg-slate-700 hover:bg-slate-600',
          className,
        )}
        {...rest}
      >
        {running ? 'Stop' : 'Clear'} {text}
      </button>
    )
  }

  if (duration !== undefined) {
    return (
      <button
        type="button"
        onClick={() => start(duration)}
        className={cx(
          'ss-timer-button rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium tabular-nums text-slate-200 transition-colors hover:border-slate-500',
          className,
        )}
        {...rest}
      >
        Start {label ?? name}
      </button>
    )
  }

  return (
    <div className={cx('ss-timer-button flex flex-col gap-1', className)} {...rest}>
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
