import { useToggleGroup } from '../../hooks/useToggleGroup'
import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'toggles'

/**
 * @typedef {object} ToggleProps
 * @property {string} name - Names a value under `toggles` — e.g. `lowerthird`.
 * @property {string} [label] - Names what is toggled: the button reads "Show <label>".
 * @property {string} [group] - A group's name. Buttons sharing one behave as radio buttons.
 * @property {import("react").ReactNode} [children] - Replaces the generated "Show <label>" text.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * An on/off button for a path under `toggles`, which is what a graphic watches to
 * know whether to be on air. `group` turns a set of them into radio buttons.
 * Writes immediately.
 *
 * **`group` is a name you invent.** Give the same one to every button that should
 * be mutually exclusive and the group works out its own membership — nothing has to
 * list the others, and adding a fourth button is adding a fourth button. Two
 * different names are two independent rows.
 *
 * @example
 * <Toggle name="lowerthird" label="Lower third" />
 *
 * @example
 * // Exactly one of these can be on at a time
 * <Toggle name="stats" label="Stats" group="panels" />
 * <Toggle name="roster" label="Roster" group="panels" />
 * <Toggle name="bracket" label="Bracket" group="panels" />
 *
 * @param {ToggleProps & import("react").ButtonHTMLAttributes<HTMLElement>} props
 */
export function Toggle({ name, label, group, className, children, ...rest }) {
  const path = `${NAMESPACE}.${name}`
  const active = Boolean(useVelcroValue(path, false))
  const mutate = useVelcroMutate()
  const members = useToggleGroup(group, path)

  const onClick = () => {
    if (group) {
      mutate('only', { group: members(), active: active ? null : path })
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
