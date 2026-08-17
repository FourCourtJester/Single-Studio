import { Suspense, lazy, useMemo } from 'react'

import { useStudio } from '../studio/context'
import { SaveButton } from '../components/control/SaveButton'
import { SourceList } from '../components/control/SourceList'

/**
 * The operator's board. Designed to run as an OBS custom browser dock, which is
 * what puts it in the same CEF process as the browser sources and therefore on
 * the same SharedWorker.
 */
export function ControlPage() {
  const { studio } = useStudio()

  const View = useMemo(() => lazy(() => Promise.resolve(studio.control()).then((mod) => ({ default: mod.default ?? mod }))), [studio])

  return (
    <div className="ss-control min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-800 bg-slate-950/90 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3">
        <h1 className="min-w-0 truncate text-sm font-semibold uppercase tracking-widest text-slate-300">{studio.name}</h1>
        <SaveButton className="ml-auto" />
      </header>
      <main className="flex flex-col gap-3 p-3 sm:gap-4 sm:p-4">
        <Suspense fallback={<p className="text-sm text-slate-500">Loading control surface&hellip;</p>}>
          <View />
        </Suspense>
        <SourceList />
      </main>
    </div>
  )
}
