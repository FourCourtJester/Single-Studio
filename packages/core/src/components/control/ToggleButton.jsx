import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'

/**
 * @typedef {object} ToggleButtonProps
 * @property {string} name - Path under `namespace`, e.g. `home.score`.
 * @property {string} [label] - Shown above the control.
 * @property {string[]} [group] - Names that turn off when this turns on — radio-button behaviour.
 * @property {import("react").ReactNode} [children] - Replaces the generated "Show <label>" text.
 * @property {string} [namespace] - Where the value lives. Defaults to `toggles`.
 * @property {string} [className] - Added to the component's own classes.
 */
/** On/off button. Pass `group` for radio-button behaviour across several paths. *
 * @param {ToggleButtonProps & import("react").ButtonHTMLAttributes<HTMLElement>} props
 */
export function ToggleButton({ name, label, group, namespace = 'toggles', className, children, ...rest }) {
  const path = `${namespace}.${name}`
  const active = Boolean(useVelcroValue(path, false))
  const mutate = useVelcroMutate()

  const onClick = () => {
    if (group?.length) {
      mutate('only', { group: group.map((key) => `${namespace}.${key}`), active: active ? null : path })
      return
    }

    mutate('toggle', path)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'ss-toggle-button rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-sky-600 text-white hover:bg-sky-500' : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500',
        className,
      )}
      {...rest}
    >
      {children ?? `${active ? 'Hide' : 'Show'} ${label ?? name}`}
    </button>
  )
}
