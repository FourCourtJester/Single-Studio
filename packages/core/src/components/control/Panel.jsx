import { cx } from '../../toolkits/cx'

/**
 * @typedef {object} PanelProps
 * @property {string} [title] - Heading for the group.
 * @property {import("react").ReactNode} [children] - Controls. They sit side by side and wrap onto the next line as needed.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * A titled group of controls that arranges itself. The controls sit side by side
 * and drop onto the next line when they run out of room, so one board works both in
 * a narrow OBS dock and full screen on a second monitor without you writing a layout
 * for either.
 *
 * To change how early they wrap, set `--ss-control-min` — it is the narrowest a
 * control is allowed to get before the row breaks. The panel's own box is
 * `.ss-panel-body` in the stylesheet if you want to take it further.
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
