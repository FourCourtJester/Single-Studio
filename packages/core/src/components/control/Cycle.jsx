import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

/**
 * @typedef {object} CycleProps
 * @property {string} name - Names a value under `variables` — e.g. `home.score`.
 * @property {string} [label] - Shown above the control.
 * @property {string[]} [options] - Stepped through in order, wrapping back to unset. One option makes it a checkbox.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * One button that steps through a list of values in order, wrapping back to unset
 * at the end. With a single option it is a checkbox: press to set it, press again
 * to clear it — which is what to reach for when a graphic only needs "on or the
 * value, or nothing". Writes immediately.
 *
 * @example
 * <Cycle name="period" label="Game" options={['Game 1', 'Game 2', 'Tiebreak']} />
 *
 * @example
 * // One option, so it toggles between that value and nothing
 * <Cycle name="status" label="Live" options={['LIVE']} />
 *
 * @param {CycleProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Cycle({ name, label, options = [], className, ...rest }) {
  const path = `${NAMESPACE}.${name}`
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
