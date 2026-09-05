import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { qualify } from '../../toolkits/address'
import { cx } from '../../toolkits/cx'
import { Confirm } from './Confirm'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

/**
 * @typedef {object} SwapButtonProps
 * @property {string[]} [names] - One side, then the other, spelled the same way. Cut in half and traded.
 * @property {string[]} [paths] - Full paths, for trading values outside `variables`.
 * @property {string} [label] - Names what gets traded, on the button. Defaults to `"Swap"`.
 * @property {boolean} [confirm] - Ask before trading. Defaults to `true`; pass `confirm={false}` to trade on one press.
 * @property {import("react").ReactNode} [children] - Replaces the generated text.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Trade two sides of the board — teams changing ends. Asks first.
 *
 * **It asks by default.** One press arms it, a second does it, and a few seconds
 * of silence disarms it. A swap is undone by swapping back, so this is `warn`
 * rather than `danger` -- but it puts both team names and both scores on the wrong
 * side of a scoreboard the instant it lands, live, and the second press costs less
 * than the ten seconds an operator spends working out what just happened.
 *
 * `confirm={false}` gives back the single press.
 *
 * List one side, then the other, in the same order. The list is cut down the middle
 * and the halves trade position for position:
 *
 *   names={['home.name', 'home.score', 'away.name', 'away.score']}
 *           ^--------- one side ----^  ^--------- the other ---^
 *
 * Writing both halves the same way round is what makes it checkable at a glance:
 * read down one half, read down the other, and they should say the same words. An
 * odd number of names has no halves and throws rather than dropping one.
 *
 * `paths` reaches values outside `variables`, which `names` does not. The two are
 * concatenated, so a swap that mixes namespaces still has to add up to two halves.
 *
 * @example
 * <SwapButton label="sides" names={['home.name', 'home.score', 'away.name', 'away.score']} />
 *
 * @example
 * // Longer sides stay readable, because neither half is written backwards
 * <SwapButton
 *   label="sides"
 *   names={['home.name', 'home.city', 'home.colour', 'away.name', 'away.city', 'away.colour']}
 * />
 *
 * @example
 * // `paths` reaches outside `variables`, which `names` does not
 * <SwapButton label="scenes" paths={['toggles.left', 'toggles.right']} />
 *
 * @param {SwapButtonProps & import("react").ButtonHTMLAttributes<HTMLElement>} props
 */
export function SwapButton({ names = [], paths = [], label = 'Swap', confirm = true, className, children, ...rest }) {
  const mutate = useVelcroMutate()
  const targets = qualify({ names, paths, namespace: NAMESPACE })

  const swap = () => mutate('swap', targets)

  if (confirm) {
    return (
      <Confirm className={cx('ss-swap', className)} label={label} onConfirm={swap} tone="warn" title={label} {...rest}>
        {children}
      </Confirm>
    )
  }

  return (
    <button
      type="button"
      onClick={swap}
      className={cx('ss-swap rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-400', className)}
      {...rest}
    >
      {children ?? label}
    </button>
  )
}
