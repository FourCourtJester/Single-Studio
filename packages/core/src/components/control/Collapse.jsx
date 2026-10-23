import { useState } from 'react'

import { cx } from '../../toolkits/cx'
import { Icon } from '../common/Icon'

/**
 * Whether something on the board is folded away, and a function that flips it:
 * `const [collapsed, toggle] = useCollapsed()`. Folded to begin with;
 * `useCollapsed(false)` starts it open. What a collapsible `Panel` folds with, for
 * folding anything else the same way -- a team card inside a panel, a row of
 * advanced settings.
 *
 * Starts folded unless told otherwise, on every load, as a panel does. Component
 * state and nothing else: not the show, which would fold the same thing on every
 * operator's board, and not browser storage, so a reload is always the same board.
 *
 * @example
 * function TeamCard({ team }) {
 *   const [collapsed, toggle] = useCollapsed()
 *   const body = useId()
 *
 *   return (
 *     <div>
 *       <button type="button" onClick={toggle} aria-expanded={!collapsed} aria-controls={body}>
 *         <Chevron collapsed={collapsed} /> {team}
 *       </button>
 *       <div id={body} hidden={collapsed}>…</div>
 *     </div>
 *   )
 * }
 *
 * @param {boolean} [initial] - Start folded. Defaults to `true`; `false` starts it open.
 * @returns {[boolean, () => void]} Whether it is folded, and a function that folds or opens it.
 */
export function useCollapsed(initial = true) {
  const [collapsed, setCollapsed] = useState(Boolean(initial))

  return [collapsed, () => setCollapsed((was) => !was)]
}

/**
 * @typedef {object} ChevronProps
 * @property {boolean} [collapsed] - Folded: turned a quarter to point at what it belongs to.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * The fold's chevron: pointing down when open, turned a quarter when folded, as a
 * `Panel`'s is. Decoration -- the button it sits in says what it does, with
 * `aria-expanded` saying which way it is.
 *
 * @example
 * <Chevron collapsed={collapsed} />
 *
 * @param {ChevronProps & import("react").SVGAttributes<SVGElement>} props
 */
export function Chevron({ collapsed = false, className, ...rest }) {
  return <Icon name="chevron" className={cx('ss-chevron transition-transform motion-reduce:transition-none', collapsed && '-rotate-90', className)} {...rest} />
}
