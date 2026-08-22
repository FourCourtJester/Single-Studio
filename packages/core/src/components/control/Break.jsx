import { cx } from '../../toolkits/cx'

/**
 * @typedef {object} BreakProps
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Forces a line break inside a `Panel`, for when the natural wrap puts related
 * controls on different rows.
 *
 * Layout only, no state. `Panel` lays its children out with flex-wrap, so this is
 * how a studio groups controls into deliberate rows instead of letting them reflow
 * wherever the container width happens to put them.
 *
 * @example
 * <Panel title="Scores">
 *   <Stepper name="home.score" label="Home" />
 *   <Break />
 *   <Select name="period" options={PERIODS} />
 * </Panel>
 *
 * @param {BreakProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Break({ className, ...rest }) {
  return <div aria-hidden="true" className={cx('ss-break w-full basis-full', className)} {...rest} />
}
