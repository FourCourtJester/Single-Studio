import { Suspense, lazy, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { usePageTitle } from '../hooks/usePageTitle'
import { useStudio } from '../studio/context'
import { SaveButton } from '../components/control/SaveButton'
import { Menu } from '../components/control/Menu'
import { MutationTrouble } from '../components/control/MutationTrouble'
import { BoardContext, createBoard } from '../components/control/board'

/**
 * The operator's board. Designed to run as an OBS custom browser dock, which is
 * what puts it in the same CEF process as the browser sources and therefore on
 * the same SharedWorker.
 */
const boardCrashed = (error, retry) => (
  <div
    role="alert"
    className="ss-control-crashed flex flex-col items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100"
  >
    <strong>Your control surface crashed.</strong>
    <pre className="max-h-64 w-full overflow-auto whitespace-pre-wrap rounded bg-slate-950/60 p-3 font-mono text-xs text-rose-200">
      {error?.stack || String(error)}
    </pre>
    <p className="text-xs text-rose-200/80">Your show is unaffected — this is the board, not what is on air. Graphics already open keep running.</p>
    <button type="button" onClick={retry} className="rounded-md border border-rose-400/50 px-3 py-1.5 text-xs font-medium hover:bg-rose-500/20">
      Try again
    </button>
  </div>
)

export function ControlPage() {
  const { studio } = useStudio()

  usePageTitle(studio.name)

  const View = useMemo(() => lazy(() => Promise.resolve(studio.control()).then((mod) => ({ default: mod.default ?? mod }))), [studio])

  // The slot BoardBar draws into is state rather than a ref so the bars re-render
  // once it exists: on the first render there is nothing to portal into yet.
  const [bar, setBar] = useState(null)
  const [board] = useState(createBoard)
  const shared = useMemo(() => ({ bar, board }), [bar, board])
  const root = useRef(null)
  const head = useRef(null)

  // The header's height as a property, for the scroll margin that keeps a panel
  // brought into view from landing under it. Measured rather than a number: the bar
  // is as tall as its studio makes it, and changes when they do.
  useLayoutEffect(() => {
    const measure = () => root.current?.style.setProperty('--ss-head-height', `${head.current?.offsetHeight ?? 0}px`)
    const watch = new ResizeObserver(measure)

    measure()
    watch.observe(head.current)

    return () => watch.disconnect()
  }, [])

  return (
    <div ref={root} className="ss-control min-h-screen bg-slate-950 text-slate-100">
      <div ref={head} className="ss-control-head sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        {/*
          One row, never two. `flex-wrap` was here and it wraps *before* it truncates:
          a long studio name in a narrow dock took the full width, pushed the tools onto
          a second line, and the bar grew a row. That was tolerable while the tools were
          always visible; once they collapse it leaves an empty second row taking height
          for nothing. Without wrapping the h1 shrinks instead -- which is what `min-w-0
          truncate` is for -- so the name ellipses and the bar stays one row at any width.
        */}
        <header className="ss-control-bar flex items-center gap-x-3">
          <h1 className="min-w-0 truncate text-sm font-semibold uppercase tracking-widest text-slate-300">{studio.name}</h1>
          <Menu className="ml-auto shrink-0" />
          <SaveButton />
        </header>
        {/*
          The studio's own bar: BoardBar portals into this. Hidden by :empty rather
          than by state, so a board with no BoardBar has nothing here at all -- no
          border, no padding -- and nothing to keep in step. No height, row limit or
          overflow: it is the studio's, and grows with what they put in it.
        */}
        <div ref={setBar} className="ss-board-bar flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-800 empty:hidden" />
      </div>
      <main className="ss-board flex flex-col">
        {/*
          Above the studio's own panels and outside their boundary: the panel whose
          button failed may be the one that has crashed, and this has to survive it.
        */}
        <MutationTrouble />
        {/*
          The board is not on air, so a crash here is shown rather than swallowed.
          An operator looking at a panel that silently stopped existing cannot tell
          whether they mis-clicked or the studio broke.
        */}
        <ErrorBoundary label="the control surface" fallback={boardCrashed}>
          <Suspense fallback={<p className="text-sm text-slate-500">Loading control surface&hellip;</p>}>
            <BoardContext.Provider value={shared}>
              <View />
            </BoardContext.Provider>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}
