import { cx } from '../../toolkits/cx'

/**
 * @typedef {object} PanelProps
 * @property {string} [title] - Heading for the group.
 * @property {import("react").ReactNode} [children] - Controls, which wrap in a flex row.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Titled grouping for the control surface. Layout only, no state.
 *
 * Children wrap responsively so the same board works in a narrow OBS dock and
 * full screen -- see `.ss-panel-body` in the stylesheet, and `--ss-control-min`
 * to retune where it wraps.
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
