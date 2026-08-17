import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { cx } from '../../toolkits/cx'

/** Trade values pairwise -- teams changing ends, home/away flipping. */
export function SwapButton({ paths = [], label = 'Swap', className, children, ...rest }) {
  const mutate = useVelcroMutate()

  return (
    <button
      type="button"
      onClick={() => mutate('swap', paths)}
      className={cx('ss-swap rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-400', className)}
      {...rest}
    >
      {children ?? label}
    </button>
  )
}
