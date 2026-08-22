import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { qualify } from '../../toolkits/address'
import { cx } from '../../toolkits/cx'

/**
 * @typedef {object} ResetButtonProps
 * @property {string[]} [names] - Cleared back to each source's own fallback.
 * @property {string[]} [paths] - Fully-qualified paths, for clearing across namespaces.
 * @property {string} [namespace] - Where the value lives. Defaults to `variables`.
 * @property {string} [label] - Shown above the control. Defaults to `"Reset"`.
 * @property {boolean} [confirm] - Ask before clearing.
 * @property {import("react").ReactNode} [children] - Replaces the generated "Reset <label>" text.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Clear a set of paths back to nothing.
 *
 * Uses `unset` rather than writing empty strings, so the keys are removed and each
 * source falls back to its own default. Writing '' would leave the paths present
 * and holding blanks, which looks the same in the board and different on air.
 *
 * `label` names what gets cleared, and the button says "Reset <label>" -- so
 * `label="draft"` reads "Reset draft" rather than a red button saying "draft",
 * which told an operator the colour was dangerous but not what it would do.
 *
 * Takes `names` the way every other component does -- `names={['home.score']}`
 * against a `namespace` that defaults to `variables`. `paths` still works and is
 * still the answer for reaching across namespaces in one press, clearing a toggle
 * and the value it was showing together.
 *
 * @param {ResetButtonProps & import("react").ButtonHTMLAttributes<HTMLElement>} props
 */
export function ResetButton({ names = [], paths = [], namespace = 'variables', label = 'Reset', confirm = false, className, children, ...rest }) {
  const mutate = useVelcroMutate()
  const targets = qualify({ names, paths, namespace })

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
