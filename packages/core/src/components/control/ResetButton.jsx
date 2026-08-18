import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { cx } from '../../toolkits/cx'

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
 */
export function ResetButton({ paths = [], label = 'Reset', confirm = false, className, children, ...rest }) {
  const mutate = useVelcroMutate()

  // A bare `label="Reset"` is the noun and the verb at once; anything else is just
  // the noun and needs the verb in front of it.
  const text = String(label).trim().toLowerCase() === 'reset' ? 'Reset' : `Reset ${label}`

  const onClick = () => {
    // Destructive and easy to hit by accident mid-show, so it can ask first.
    if (confirm && !window.confirm(`Reset ${label}?`)) return

    mutate('unset', paths)
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
