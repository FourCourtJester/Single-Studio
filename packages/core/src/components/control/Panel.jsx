import { cx } from '../../toolkits/cx'

/**
 * @typedef {object} PanelProps
 * @property {string} [title] - Heading for the group.
 * @property {import("react").ReactNode} [children] - Controls, one row each. Put several in a `Row` to share a line.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * A titled group of controls, one row per child, top to bottom.
 *
 * Rows rather than a wrapping line because the board's narrowest shape is the one
 * that matters most: an OBS dock is often a slim column, and controls that sit side
 * by side and wrap where the width happens to break put related things on different
 * lines in a dock and the same things in another order full screen. A row is a row
 * at every width. To put controls side by side when there is room, put them in a
 * `Row`, which stacks them again when there is not.
 *
 * The panel's own box is `.ss-panel-body` in the stylesheet if you want to take it
 * further.
 *
 * @example
 * <Panel title="Scores">
 *   <Row>
 *     <Field name="home.name" label="Home" />
 *     <Stepper name="home.score" label="Home score" />
 *   </Row>
 *   <Toggle name="scores" label="scores" />
 * </Panel>
 *
 * @param {PanelProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Panel({ title, children, className, ...rest }) {
  return (
    <section className={cx('ss-panel rounded-lg border border-slate-800 bg-slate-900/40 p-3 sm:p-4', className)} {...rest}>
      {title ? <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2> : null}
      <div className="ss-panel-body">{children}</div>
    </section>
  )
}
