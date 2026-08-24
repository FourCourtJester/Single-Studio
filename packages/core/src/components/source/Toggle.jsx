import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { Transition } from '../common/Transition'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'toggles'

/**
 * @typedef {object} ToggleProps
 * @property {string} name - Names a value under `toggles` — e.g. `lowerthird`.
 * @property {import("react").ReactNode} [children] - Shown while the toggle is on.
 * @property {string} [transition] - Motion variants, space-separated — e.g. `"slide-up ease-back"`. See [the transitions guide](getting-started.md#transitions).
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Shows its children while a toggle is on, and animates them in and out. This is
 * how a whole graphic is put on and taken off air.
 *
 * Hidden until the path has loaded, so a source rebuilt mid-show never flashes its
 * contents before finding out it was supposed to be off.
 *
 * @example
 * <Toggle name="lowerthird">
 *   <LowerThird />
 * </Toggle>
 *
 * @example
 * <Toggle name="stats" transition="slide-up ease-back">
 *   <StatsCard />
 * </Toggle>
 *
 * @param {ToggleProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Toggle({ name, children, className, ...rest }) {
  const { value, loaded } = useVelcroState(`${NAMESPACE}.${name}`)
  const active = loaded && Boolean(value)

  return (
    <Transition trigger={active} className={cx('ss-toggle', className)} {...rest}>
      {active ? children : null}
    </Transition>
  )
}
