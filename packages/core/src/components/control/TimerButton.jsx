import { useTimer } from '../../hooks/useTimer'
import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { parseDuration } from '../../toolkits/time'
import { cx } from '../../toolkits/cx'

/** Start or clear a countdown. `duration` accepts `90`, `'1:30'`, or `'1:02:03'`. */
export function TimerButton({ name, label, duration = '5:00', namespace = 'timers', className, ...rest }) {
  const path = `${namespace}.${name}`
  const { active, text } = useTimer(path)
  const mutate = useVelcroMutate()

  const onClick = () => mutate('timer', { [path]: active ? 0 : parseDuration(duration) })

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'ss-timer-button rounded-md px-3 py-2 text-sm font-medium tabular-nums transition-colors',
        active ? 'bg-rose-600 text-white hover:bg-rose-500' : 'border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500',
        className,
      )}
      {...rest}
    >
      {active ? `Stop ${text}` : `Start ${label ?? name}`}
    </button>
  )
}
