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
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur">
        <h1 className="text-sm font-semibold uppercase tracking-widest text-slate-300">{studio.name}</h1>
        <SaveButton className="ml-auto" />
      </header>
      <main className="flex flex-col gap-4 p-4">
        <Suspense fallback={<p className="text-sm text-slate-500">Loading control surface&hellip;</p>}>
          <View />
        </Suspense>
        <SourceList />
      </main>
    </div>
  )
}
