import { cx } from '../../toolkits/cx'

/**
 * @typedef {object} PanelProps
 * @property {string} [title] - Heading for the group.
 * @property {import("react").ReactNode} [children] - Controls, which wrap in a flex row.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * A titled group of controls. Children wrap in a flex row, so a panel reflows to
 * whatever width the dock has rather than needing a layout of its own.
 *
 * Children wrap responsively so the same board works in a narrow OBS dock and
 * full screen -- see `.ss-panel-body` in the stylesheet, and `--ss-control-min`
 * to retune where it wraps.
 *
 * @example
 * <Panel title="Scores">
 *   <Field name="home.name" label="Home" />
 *   <Stepper name="home.score" label="Home score" />
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
