import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'

/**
 * Numeric value with -/+ controls.
 *
 * Uses the `increment`/`decrement` mutations rather than writing an absolute
 * value, which is what makes two operators tapping +1 at the same moment add up
 * to +2 instead of clobbering each other. See velcro/counter.js.
 */
export function Stepper({ name, label, step = 1, namespace = 'variables', className, ...rest }) {
  const path = `${namespace}.${name}`
  const value = useVelcroValue(path, 0)
  const mutate = useVelcroMutate()

  const button = 'h-9 w-9 rounded-md border border-slate-700 bg-slate-900 text-lg leading-none text-slate-200 transition-colors hover:border-slate-500'

  return (
    <div className={cx('ss-stepper flex flex-col gap-1', className)} {...rest}>
      {label ? <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span> : null}
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Decrease ${label ?? name}`} className={button} onClick={() => mutate('decrement', { [path]: step })}>
          &minus;
        </button>
        <output className="min-w-12 rounded-md bg-slate-950 px-3 py-1.5 text-center text-xl font-semibold tabular-nums text-slate-100">
          {Number(value ?? 0)}
        </output>
        <button type="button" aria-label={`Increase ${label ?? name}`} className={button} onClick={() => mutate('increment', { [path]: step })}>
          +
        </button>
      </div>
    </div>
  )
}
