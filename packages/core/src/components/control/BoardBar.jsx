import { Children, useContext } from 'react'
import { createPortal } from 'react-dom'

import { cx } from '../../toolkits/cx'
import { BoardContext } from './board'

/**
 * @typedef {object} BoardBarProps
 * @property {import("react").ReactNode} [children] - What goes in the bar: anything at all.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * A bar of your own, under the board's top bar, holding whatever you put in it.
 *
 * Write it anywhere in your control view -- beside the panels its controls belong
 * to, inside one of them -- and what it holds appears under the top bar, and stays
 * there as the board scrolls. A board with no `BoardBar` has no bar: nothing to see,
 * nothing taking height.
 *
 * Yours to shape. The framework sets no height, no row limit and no overflow on it:
 * it wraps onto as many rows as its contents need, and `className` and `style` go on
 * this `BoardBar`'s own box, a wrapping row. Several `BoardBar`s share the one bar,
 * side by side in the order they mount. It shows whether or not the panel it is
 * written in is folded, since it is drawn in the bar, not the panel.
 *
 * `PanelJump` is the one the framework provides: a list of the board's panels that
 * opens one and folds the rest.
 *
 * The bar is a dark blue of its own, `--ss-board-bar-bg` on `.ss-control` to set
 * another. It is `.ss-board-bar` in the stylesheet, under `.ss-control-bar`, and both
 * are inside `.ss-control-head`, which is what sticks. The header's height, both
 * rows, is `--ss-head-height`.
 *
 * @example
 * <BoardBar>
 *   <PanelJump />
 * </BoardBar>
 *
 * @example
 * // Your own controls beside it, pushed to the right
 * <>
 *   <BoardBar>
 *     <PanelJump />
 *   </BoardBar>
 *   <BoardBar className="ml-auto">
 *     <Toggle name="live" label="live" size="sm" />
 *   </BoardBar>
 * </>
 *
 * @param {BoardBarProps & import("react").HTMLAttributes<HTMLDivElement>} props
 */
export function BoardBar({ children, className, ...rest }) {
  const bar = useContext(BoardContext)?.bar

  // Nothing to draw draws no box: an empty one would still show the bar, a strip of
  // padding with nothing in it, for `<BoardBar>{live && …}</BoardBar>` while not live.
  if (!bar || Children.toArray(children).length === 0) return null

  return createPortal(
    <div className={cx('ss-board-bar-group flex flex-wrap items-center gap-2', className)} {...rest}>
      {children}
    </div>,
    bar,
  )
}
