import { cx } from '../../toolkits/cx'

/**
 * A label that appears on hover or focus.
 *
 * Replaces the `title` attribute on controls that need one. A native tooltip is
 * drawn by the browser, which means it cannot be styled, cannot be aligned, and
 * wraps where it likes -- "Discard all unsaved changes" arrived as two ragged
 * lines with no way to fix it from CSS. It also waits about a second before
 * appearing, which is a long time to hold a cursor still mid-show.
 *
 * The bubble never wraps. A tooltip long enough to need two lines is a tooltip
 * that should be shorter.
 *
 * `align` matters more than it looks. These sit on icon buttons, and an icon
 * button is usually pinned to an edge -- a centred bubble under the save button
 * runs off the right of the dock, where nothing can scroll it back into view.
 * `align="end"` pins the bubble's right edge to the trigger's instead.
 *
 * The tooltip is decoration, not the accessible name: it is `aria-hidden`, and the
 * control inside keeps its own `aria-label`. Announcing both reads the button
 * twice.
 *
 * Shown on *focus-visible*, not focus. `dialog.showModal()` moves focus to the
 * first focusable thing it finds, which in a dialog whose header ends in a close
 * button is that button -- so a plain focus rule popped "Close" open every single
 * time a modal was opened, pointing at a control nobody had gone near.
 * `:focus-visible` is exactly the distinction wanted: a browser sets it when focus
 * arrived by keyboard and withholds it when focus was moved programmatically, so a
 * keyboard user still gets the label and a mouse user opening a dialog does not.
 */
const aligns = {
  center: 'left-1/2 -translate-x-1/2',
  start: 'left-0',
  end: 'right-0',
}

export function Tooltip({ label, children, align = 'center', side = 'bottom', className, ...rest }) {
  if (!label) return children

  return (
    <span className={cx('ss-tooltip group/tip relative inline-flex', className)} {...rest}>
      {children}
      <span
        aria-hidden="true"
        className={cx(
          'ss-tooltip-bubble pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-medium text-slate-200 opacity-0 shadow-lg shadow-black/40 transition-opacity duration-150 group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:opacity-100',
          aligns[align] ?? aligns.center,
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        )}
      >
        {label}
      </span>
    </span>
  )
}
