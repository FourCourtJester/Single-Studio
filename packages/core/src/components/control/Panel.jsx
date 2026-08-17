import { cx } from '../../toolkits/cx'

/** Titled grouping for the control surface. Layout only, no state. */
export function Panel({ title, children, className, ...rest }) {
  return (
    <section className={cx('ss-panel rounded-lg border border-slate-800 bg-slate-900/40 p-4', className)} {...rest}>
      {title ? <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2> : null}
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </section>
  )
}
