import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { usePageTitle } from '../hooks/usePageTitle'
import { layerNameFromUrl } from '../toolkits/url'
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
  const { studio, velcro } = useStudio()
  const [params] = useSearchParams()
  const [ready, setReady] = useState(false)
  const loader = studio.sources[name]

  // `?layer-name=` wins outright when it is there. An operator naming a browser
  // source wants that name and nothing appended to it.
  const named = layerNameFromUrl()

  usePageTitle(...(named ? [named] : [name, studio.name]))

  // Hold the whole graphic until the store is reachable.
  //
  // Per-component load gating stops values flashing, but a studio's own static
  // chrome -- a scoreboard's panel, a lower third's plate -- would still paint the
  // instant the page mounted. On a source set to unload when hidden that is a
  // visible empty shell on air every time the scene returns. Nothing renders until
  // there is a store to render from.
  useEffect(() => {
    let live = true

    velcro.ready().then(() => {
      if (live) setReady(true)
    })

    return () => {
      live = false
    }
  }, [velcro])

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
    <div
      data-source={name}
      data-theme={theme ?? undefined}
      data-ready={ready ? '' : undefined}
      className="ss-source h-screen w-screen overflow-hidden bg-transparent"
    >
      {ready ? (
        <Suspense fallback={null}>
          <View />
        </Suspense>
      ) : null}
    </div>
  )
}
