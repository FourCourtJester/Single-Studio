import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { cx } from '../../toolkits/cx'

/**
 * Clear a set of paths back to nothing.
 *
 * Uses `unset` rather than writing empty strings, so the keys are removed and each
 * source falls back to its own default. Writing '' would leave the paths present
 * and holding blanks, which looks the same in the board and different on air.
 */
export function ResetButton({ paths = [], label = 'Reset', confirm = false, className, children, ...rest }) {
  const mutate = useVelcroMutate()

  const onClick = () => {
    // Destructive and easy to hit by accident mid-show, so it can ask first.
    if (confirm && !window.confirm(`Reset ${label}?`)) return

    mutate('unset', paths)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Reset ${label}`}
      className={cx('ss-reset rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500', className)}
      {...rest}
    >
      {children ?? label}
    </button>
  )
}
