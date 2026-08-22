import { cx } from '../../toolkits/cx'

/**
 * @typedef {object} BreakProps
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Forces a line break inside a `Panel`'s wrapping flex row.
 *
 * Layout only, no state. `Panel` lays its children out with flex-wrap, so this is
 * how a studio groups controls into deliberate rows instead of letting them reflow
 * wherever the container width happens to put them.
 *
 * @param {BreakProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Break({ className, ...rest }) {
  return <div aria-hidden="true" className={cx('ss-break w-full basis-full', className)} {...rest} />
}
