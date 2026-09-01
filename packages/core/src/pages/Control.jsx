import { Suspense, lazy, useMemo } from 'react'

import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { usePageTitle } from '../hooks/usePageTitle'
import { useStudio } from '../studio/context'
import { SaveButton } from '../components/control/SaveButton'
import { Menu } from '../components/control/Menu'

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

  return (
    <div className="ss-control min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-800 bg-slate-950/90 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3">
        <h1 className="min-w-0 truncate text-sm font-semibold uppercase tracking-widest text-slate-300">{studio.name}</h1>
        <Menu className="ml-auto" />
        <SaveButton />
      </header>
      <main className="flex flex-col gap-3 p-3 sm:gap-4 sm:p-4">
        {/*
          The board is not on air, so a crash here is shown rather than swallowed.
          An operator looking at a panel that silently stopped existing cannot tell
          whether they mis-clicked or the studio broke.
        */}
        <ErrorBoundary label="the control surface" fallback={boardCrashed}>
          <Suspense fallback={<p className="text-sm text-slate-500">Loading control surface&hellip;</p>}>
            <View />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}
