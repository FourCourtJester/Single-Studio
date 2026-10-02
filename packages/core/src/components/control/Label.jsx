import { cx } from '../../toolkits/cx'
import { useRowLabel } from './Row'

/**
 * The height of a control's input line, and the floor for a button's.
 *
 * Every input, select and button that sits on the line a Row lines up takes one of
 * these, so a field, a stepper and a switch beside each other share a bottom edge
 * as well as a top. Before, a field was 42px, a button 36px and a stopwatch's
 * readout 38px, and side by side that is three bottom edges. Buttons take it as a
 * minimum so a switch with a picture in it can still be taller.
 *
 * `--ss-input-h` retunes it for a whole board.
 */
export const LINE = 'h-[var(--ss-input-h,2.5rem)]'
export const MIN_LINE = 'min-h-[var(--ss-input-h,2.5rem)]'

/**
 * A control's label line. One component so every control's line is the same height:
 * a Row lines its controls up by assuming it, and a label one pixel taller than its
 * neighbour's puts that control's input a pixel lower, which is visible down a row.
 *
 * Kept to one line, cut short with an ellipsis rather than wrapped, for the same
 * reason. The whole label is still there on hover.
 *
 * @param {object} props
 * @param {'span' | 'label'} [props.as]
 * @param {string} [props.htmlFor]
 * @param {import("react").ReactNode} props.text - The label itself.
 * @param {boolean} [props.dirty] - Shows the unsaved marker.
 * @param {import("react").ReactNode} [props.children] - Anything after the text: a count, a badge.
 * @param {string} [props.className]
 */
export function Label({ as: Tag = 'span', htmlFor, text, dirty, children, className }) {
  useRowLabel()

  return (
    <Tag
      htmlFor={htmlFor}
      className={cx('ss-label flex h-4 min-w-0 items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400', className)}
    >
      <span className="truncate" title={typeof text === 'string' ? text : undefined}>
        {text}
      </span>
      {/* Unsaved marker. An operator has to be able to see at a glance that what is
          on their screen is not what is on air. */}
      {dirty ? <span aria-label="unsaved" title="Unsaved" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" /> : null}
      {children}
    </Tag>
  )
}
