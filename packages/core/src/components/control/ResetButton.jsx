import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { qualify } from '../../toolkits/address'
import { cx } from '../../toolkits/cx'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

/**
 * @typedef {object} ResetButtonProps
 * @property {string[]} [names] - Cleared back to each source's own fallback.
 * @property {string[]} [paths] - Full paths, for clearing `toggles` or `timers` in the same press.
 * @property {string} [label] - Names what gets cleared: the button reads "Reset <label>". Defaults to `"Reset"`.
 * @property {boolean} [confirm] - Ask before clearing.
 * @property {import("react").ReactNode} [children] - Replaces the generated "Reset <label>" text.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Clear a set of values back to each source's own fallback. It unsets rather than
 * writing empties, so a graphic falls back rather than going blank.
 *
 * Uses `unset` rather than writing empty strings, so the keys are removed and each
 * source falls back to its own default. Writing '' would leave the paths present
 * and holding blanks, which looks the same in the board and different on air.
 *
 * `label` names what gets cleared, and the button says "Reset <label>" -- so
 * `label="draft"` reads "Reset draft" rather than a red button saying "draft",
 * which told an operator the colour was dangerous but not what it would do.
 *
 * Takes `names` the way every other component does. Those name values under
 * `variables`, which is where a studio's own values live; `paths` is the way to
 * reach anything else in the same press -- clearing a toggle and the value it was
 * showing together, say.
 *
 * @example
 * <ResetButton label="scores" names={['home.score', 'away.score']} />
 *
 * @example
 * // Ask first, for something that would hurt mid-show
 * <ResetButton label="the draft" names={['home.army', 'away.army']} confirm />
 *
 * @param {ResetButtonProps & import("react").ButtonHTMLAttributes<HTMLElement>} props
 */
export function ResetButton({ names = [], paths = [], label = 'Reset', confirm = false, className, children, ...rest }) {
  const mutate = useVelcroMutate()
  const targets = qualify({ names, paths, namespace: NAMESPACE })

  // A bare `label="Reset"` is the noun and the verb at once; anything else is just
  // the noun and needs the verb in front of it.
  const text = String(label).trim().toLowerCase() === 'reset' ? 'Reset' : `Reset ${label}`

  const onClick = () => {
    // Destructive and easy to hit by accident mid-show, so it can ask first.
    if (confirm && !window.confirm(`Reset ${label}?`)) return

    mutate('unset', targets)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={text}
      className={cx('ss-reset rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500', className)}
      {...rest}
    >
      {children ?? text}
    </button>
  )
}
