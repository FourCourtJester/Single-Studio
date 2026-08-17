import { cx } from '../../toolkits/cx'

/**
 * Forces a line break inside a `Panel`'s wrapping flex row.
 *
 * Layout only, no state. `Panel` lays its children out with flex-wrap, so this is
 * how a studio groups controls into deliberate rows instead of letting them reflow
 * wherever the container width happens to put them.
 */
export function Break({ className, ...rest }) {
  return <div aria-hidden="true" className={cx('ss-break w-full basis-full', className)} {...rest} />
}
