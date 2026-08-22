import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { qualify } from '../../toolkits/address'
import { cx } from '../../toolkits/cx'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

/**
 * @typedef {object} SwapButtonProps
 * @property {string[]} [names] - Traded outermost inwards: first with last, second with second-last.
 * @property {string[]} [paths] - Full paths, for trading values outside `variables`.
 * @property {string} [label] - Names what gets traded, on the button. Defaults to `"Swap"`.
 * @property {import("react").ReactNode} [children] - Replaces the generated text.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Trade values pairwise — teams changing ends. The list is swapped outermost
 * inwards, so a symmetrical row reads as one and needs no counting.
 *
 * The list is traded outermost inwards: the first swaps with the last, the second
 * with the second-last. So a symmetrical row reads as one, which is how somebody
 * checks they have it right without counting:
 *
 *   names={['home.name', 'home.score', 'away.score', 'away.name']}
 *
 * `paths` reaches values outside `variables`, which `names` does not.
 *
 * @example
 * <SwapButton label="sides" names={['home.name', 'home.score', 'away.score', 'away.name']} />
 *
 * @example
 * // `paths` reaches outside `variables`, which `names` does not
 * <SwapButton label="scenes" paths={['toggles.left', 'toggles.right']} />
 *
 * @param {SwapButtonProps & import("react").ButtonHTMLAttributes<HTMLElement>} props
 */
export function SwapButton({ names = [], paths = [], label = 'Swap', className, children, ...rest }) {
  const mutate = useVelcroMutate()
  const targets = qualify({ names, paths, namespace: NAMESPACE })

  return (
    <button
      type="button"
      onClick={() => mutate('swap', targets)}
      className={cx('ss-swap rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-400', className)}
      {...rest}
    >
      {children ?? label}
    </button>
  )
}
