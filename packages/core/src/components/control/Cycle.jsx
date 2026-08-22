import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'

/**
 * @typedef {object} CycleProps
 * @property {string} name - Path under `namespace`, e.g. `home.score`.
 * @property {string} [label] - Shown above the control.
 * @property {string[]} [options] - Stepped through in order, wrapping back to unset.
 * @property {string} [namespace] - Where the value lives. Defaults to `variables`.
 * @property {string} [className] - Added to the component's own classes.
 */
/** Step through a fixed list of options, wrapping back to unset. *
 * @param {CycleProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Cycle({ name, label, options = [], namespace = 'variables', className, ...rest }) {
  const path = `${namespace}.${name}`
  const value = useVelcroValue(path, '')
  const mutate = useVelcroMutate()

  const onClick = () => {
    const index = options.indexOf(value)
    const next = options[index + 1]

    mutate('set', { [path]: index === -1 ? options.at(0) : (next ?? '') })
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
