import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { usePageTitle } from '../hooks/usePageTitle'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { titleize } from '../toolkits/slug'
import { debugFromUrl, layerNameFromUrl } from '../toolkits/url'
import { useStudio } from '../studio/context'
import { NotFoundPage } from './NotFound'

/**
 * One graphic, rendered for an OBS browser source.
 *
 * Nothing is added around the studio's own markup and the background stays
 * transparent -- OBS composites this straight over the scene.
 */
/** Only ever rendered under `?debug`, so it can afford to be loud. */
const crashed = (error, retry) => (
  <div className="ss-source-crashed absolute inset-0 flex flex-col items-start gap-2 overflow-auto bg-rose-950/95 p-4 font-mono text-xs text-rose-100">
    <strong className="text-sm">This graphic crashed.</strong>
    <pre className="whitespace-pre-wrap">{error?.stack || String(error)}</pre>
    <button type="button" onClick={retry} className="rounded border border-rose-400/60 px-2 py-1 hover:bg-rose-500/20">
      Try again
    </button>
    <p className="text-rose-300/80">Shown because this URL has ?debug. Without it a crashed graphic renders nothing.</p>
  </div>
)

export function SourcePage() {
  // The whole splat, not one segment: a key may be `lower-thirds/single`, and
  // react-router hands a splat back under '*'.
  const name = useParams()['*']
  const { studio, velcro } = useStudio()
  const [params] = useSearchParams()
  const [ready, setReady] = useState(false)
  const loader = studio.sources[name]

  // `?layer-name=` wins outright when it is there. An operator naming a browser
  // source wants that name and nothing appended to it.
  const named = layerNameFromUrl()

  // Titled the same way the operator's own Browser sources list titles it, from the
  // same function -- so `lower-thirds/single` reads "Lower Thirds / Single" in both
  // places rather than as a slug in one and a name in the other.
  usePageTitle(...(named ? [named] : [titleize(name), studio.name]))

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
  const debug = debugFromUrl()

  return (
    <div
      data-source={name}
      data-theme={theme ?? undefined}
      data-ready={ready ? '' : undefined}
      className="ss-source h-screen w-screen overflow-hidden bg-transparent"
    >
      {ready ? (
        // Nothing on air when a graphic crashes: a missing lower third reads as a
        // cue that did not fire, where a red box reads as the broadcast being
        // broken. `?debug` -- which an author types and OBS never has -- shows it
        // instead. The console gets it either way.
        <ErrorBoundary label={name} fallback={debug ? crashed : undefined}>
          <Suspense fallback={null}>
            <View />
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </div>
  )
}
