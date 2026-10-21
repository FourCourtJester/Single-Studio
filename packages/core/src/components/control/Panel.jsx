import { useId, useState } from 'react'

import { cx } from '../../toolkits/cx'
import { Icon } from '../common/Icon'

/**
 * @typedef {object} PanelProps
 * @property {string} [title] - Heading for the group.
 * @property {import("react").ReactNode | ((state: { open: boolean }) => import("react").ReactNode)} [actions] - Anything at all, right-aligned on the title line: a reset, a swap, a status light. Or a function that returns it, given whether the panel is open.
 * @property {boolean} [collapsible] - The title folds the panel away and opens it again. Defaults to `false`.
 * @property {boolean} [defaultOpen] - A collapsible panel starts folded on every load; `true` starts this one open. Defaults to `false`.
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
 * **`actions`** go on the title line, at the right: anything, not only buttons. They
 * stay in the header, and keep working, while the panel is folded. In a dock too
 * narrow for both, they drop under the title rather than squeezing it.
 *
 * **`collapsible`** makes the title a button that folds the body away. Folded is
 * where every collapsible panel starts, on every load: a fresh board is a short
 * list of headers, and the operator opens what the next segment needs. The fold is
 * this page's alone -- not the show's, which would fold the panel on every
 * operator's board, and not remembered, so a reload is always the same board.
 * Folding hides the controls without unmounting them, so a draft typed into a
 * folded panel is still there when it opens.
 *
 * Without a `title`, `actions` or `collapsible`, there is no header at all. Actions
 * without a title still get their line; a collapsible panel without one gets a
 * chevron on its own to fold it by.
 *
 * The panel's own box is `.ss-panel-body` in the stylesheet if you want to take it
 * further; the title line is `.ss-panel-header`, the actions `.ss-panel-actions`.
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
 * @example
 * // Folded until the operator opens it, with its reset reachable either way
 * <Panel title="Slate" collapsible actions={<ResetButton label="slate" names={['slate.title', 'slate.subtitle']} />}>
 *   <Field name="slate.title" label="Title" />
 *   <Field name="slate.subtitle" label="Subtitle" />
 * </Panel>
 *
 * @example
 * // Actions that change with the fold: the swap only while the names are in view
 * <Panel title="Teams" collapsible actions={({ open }) => open && <SwapButton label="sides" names={['home.name', 'away.name']} />}>
 *   …
 * </Panel>
 *
 * @param {PanelProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Panel({ title, actions, collapsible = false, defaultOpen = false, children, className, ...rest }) {
  const [open, setOpen] = useState(() => !collapsible || defaultOpen)
  const body = useId()

  // Read every render rather than stored, so a panel that stops being collapsible
  // is simply open, whatever it was folded to.
  const folded = collapsible && !open
  const tools = typeof actions === 'function' ? actions({ open: !folded }) : actions
  const hasTools = tools !== undefined && tools !== null && tools !== false && tools !== ''

  const chevron = <Icon name="chevron" className={cx('transition-transform motion-reduce:transition-none', folded && '-rotate-90')} />

  // The button goes inside the heading, never the other way round: a heading inside
  // a button is invalid HTML, and a screen reader's list of headings loses it. The
  // negative margin and padding give it a bigger target without moving the title.
  const fold = (label) => (
    <button
      type="button"
      onClick={() => setOpen((was) => !was)}
      aria-expanded={!folded}
      aria-controls={body}
      aria-label={label ? undefined : folded ? 'Open panel' : 'Fold panel'}
      className="ss-panel-fold -m-1 flex items-center gap-2 rounded p-1 text-left uppercase tracking-wide transition-colors hover:text-slate-200"
    >
      {chevron}
      {label}
    </button>
  )

  const heading = title ? (
    <h2 className="min-w-0 text-sm font-semibold uppercase tracking-wide text-slate-400">{collapsible ? fold(title) : title}</h2>
  ) : collapsible ? (
    <span className="text-slate-400">{fold(null)}</span>
  ) : null

  return (
    <section
      className={cx('ss-panel rounded-lg border border-slate-800 bg-slate-900/40 p-3 sm:p-4', className)}
      data-open={collapsible ? String(!folded) : undefined}
      {...rest}
    >
      {heading || hasTools ? (
        // Wraps rather than shrinking the title: in a slim dock the actions take the
        // next line, still at the right, and the title keeps its words.
        <header className={cx('ss-panel-header flex flex-wrap items-center gap-x-3 gap-y-2', !folded && 'mb-3')}>
          {heading}
          {hasTools ? <div className="ss-panel-actions ml-auto flex flex-wrap items-center justify-end gap-2">{tools}</div> : null}
        </header>
      ) : null}
      <div id={body} className="ss-panel-body" hidden={folded}>
        {children}
      </div>
    </section>
  )
}
