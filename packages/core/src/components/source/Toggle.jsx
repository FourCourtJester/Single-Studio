import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { Transition } from '../common/Transition'

/**
 * @typedef {object} ToggleProps
 * @property {string} name - Path under `namespace`, e.g. `home.score`.
 * @property {import("react").ReactNode} [children] - Shown while the toggle is on.
 * @property {string} [namespace] - Where the value lives. Defaults to `toggles`.
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
export function Toggle({ name, children, className, namespace = 'toggles', ...rest }) {
  const { value, loaded } = useVelcroState(`${namespace}.${name}`)
  const active = loaded && Boolean(value)

  return (
    <Transition trigger={active} className={cx('ss-toggle', className)} {...rest}>
      {active ? children : null}
    </Transition>
  )
}
