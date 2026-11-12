import { flushSync } from 'react-dom'

import { cx } from '../../toolkits/cx'
import { useBoardPanels } from './board'

const FOLD_ALL = '\u0000fold'

/**
 * @typedef {object} PanelJumpProps
 * @property {string} [label] - What the list says before anything is chosen. Defaults to `"Jump to…"`.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * A list of the board's panels: choose one and the board folds every other
 * collapsible panel, opens that one, and scrolls it to just under the bar.
 *
 * Every titled `Panel` is listed, in board order, with nothing to register: a panel
 * inside a panel is indented under it, and choosing it opens the one it is in as well.
 * "Fold all", at the head of the list, folds every collapsible panel and goes back to
 * the top. A panel that is not collapsible is still listed and scrolled to. Untitled
 * panels are not listed, having nothing to be listed by.
 *
 * A panel near the foot of the board stops as far up as the page will scroll,
 * which with every other panel folded can be well short of the bar -- in the
 * fixture, a panel second from the bottom of a 1280×800 board landed 413px down
 * with the page scrolled to its end. It is in view; it is not at the top.
 *
 * A native select, so the keyboard works as it does on any other: Tab to it, the
 * arrow keys or a letter to choose. After a jump the chosen panel's title has the
 * focus, so Enter folds it again and Tab goes into it.
 *
 * Lives in a `BoardBar`, so it stays in reach as the board scrolls; it works anywhere
 * on the board.
 *
 * @example
 * <BoardBar>
 *   <PanelJump />
 * </BoardBar>
 *
 * @param {PanelJumpProps & import("react").SelectHTMLAttributes<HTMLSelectElement>} props
 */
export function PanelJump({ label = 'Jump to…', className, ...rest }) {
  const panels = useBoardPanels()
  const titled = panels.filter((panel) => panel.title)
  const byId = new Map(panels.map((panel) => [panel.id, panel]))

  // How many titled panels a panel is inside. An untitled one in between still opens
  // with the rest, but has no line of its own to indent under.
  const depth = (panel) => {
    let count = 0

    for (let at = byId.get(panel.parent); at; at = byId.get(at.parent)) if (at.title) count += 1

    return count
  }

  const jump = (id) => {
    const all = panels
    const keep = new Set()

    for (let at = id; at; at = byId.get(at)?.parent) keep.add(at)

    // Folded and opened before the scroll is measured, not after: a jump down the
    // board with the panels above it still open measures a position they are about
    // to give back, and lands that far past the panel.
    flushSync(() => {
      for (const panel of all) if (panel.collapsible) panel.open(keep.has(panel.id))
    })

    if (id === FOLD_ALL) {
      window.scrollTo({ top: 0 })
      return
    }

    const element = byId.get(id)?.element()

    // Its scroll margin is the header's height (see base.css), so the bar does not
    // land over the panel it brought into view.
    element?.scrollIntoView({ block: 'start' })
    element?.querySelector(':scope > .ss-panel-header .ss-panel-fold')?.focus({ preventScroll: true })
  }

  return (
    <select
      value=""
      onChange={(event) => jump(event.target.value)}
      aria-label={label}
      className={cx(
        'ss-panel-jump max-w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-100 outline-none transition-colors focus:border-sky-500',
        className,
      )}
      {...rest}
    >
      <option value="" disabled>
        {label}
      </option>
      <option value={FOLD_ALL}>Fold all</option>
      {titled.map((panel) => (
        <option key={panel.id} value={panel.id}>
          {'\u00a0\u00a0\u00a0'.repeat(depth(panel))}
          {panel.title}
        </option>
      ))}
    </select>
  )
}
