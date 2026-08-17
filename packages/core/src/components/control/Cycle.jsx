import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'

/** Step through a fixed list of choices, wrapping back to unset. */
export function Cycle({ name, label, choices = [], namespace = 'variables', className, ...rest }) {
  const path = `${namespace}.${name}`
  const value = useVelcroValue(path, '')
  const mutate = useVelcroMutate()

  const onClick = () => {
    const index = choices.indexOf(value)
    const next = choices[index + 1]

    mutate('set', { [path]: index === -1 ? choices.at(0) : (next ?? '') })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'ss-cycle rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500',
        className,
      )}
      {...rest}
    >
      <span className="text-xs uppercase tracking-wide text-slate-500">{label ?? name}</span>
      <span className="ml-2 font-medium">{value || 'None'}</span>
    </button>
  )
}
