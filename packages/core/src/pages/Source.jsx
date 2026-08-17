import { Suspense, lazy, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { useStudio } from '../studio/context'
import { NotFoundPage } from './NotFound'

/**
 * One graphic, rendered for an OBS browser source.
 *
 * Nothing is added around the studio's own markup and the background stays
 * transparent -- OBS composites this straight over the scene.
 */
export function SourcePage() {
  const { name } = useParams()
  const { studio } = useStudio()
  const [params] = useSearchParams()
  const loader = studio.sources[name]

  const View = useMemo(() => (loader ? lazy(() => Promise.resolve(loader()).then((mod) => ({ default: mod.default ?? mod }))) : null), [loader])

  if (!View) {
    return (
      <NotFoundPage
        title={`Unknown source: ${name}`}
        detail={`Add it to the \`sources\` map in your studio definition. Known sources: ${Object.keys(studio.sources).join(', ') || 'none'}.`}
      />
    )
  }

  const theme = params.get('theme')

  return (
    <div data-source={name} data-theme={theme ?? undefined} className="ss-source h-screen w-screen overflow-hidden bg-transparent">
      <Suspense fallback={null}>
        <View />
      </Suspense>
    </div>
  )
}
