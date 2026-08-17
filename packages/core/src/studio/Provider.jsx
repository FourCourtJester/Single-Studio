import { useEffect, useMemo, useState } from 'react'

import { UnsupportedPage } from '../pages/Unsupported'
import { createVelcroClient } from '../velcro/client'
import { DraftProvider } from './DraftProvider'
import { getSupport } from '../velcro/support'
import { StudioContext } from './context'

/**
 * Owns the one Velcro client for this page and hands it to the tree.
 *
 * Deliberately not a module-level singleton: passing it through context keeps
 * the store injectable, which is what makes components testable without a
 * SharedWorker.
 */
function Provider({ studio, children, fallback }) {
  const [ready, setReady] = useState(false)

  const value = useMemo(() => {
    const velcro = createVelcroClient({ name: studio.id, worker: studio.worker })
    return { studio, velcro }
  }, [studio])

  useEffect(() => {
    let live = true

    value.velcro.ready().then(() => {
      if (live) setReady(true)
    })

    return () => {
      live = false
    }
  }, [value])

  if (!ready && fallback) return fallback

  return (
    <StudioContext.Provider value={value}>
      <DraftProvider>{children}</DraftProvider>
    </StudioContext.Provider>
  )
}

/**
 * Gate the store behind a capability check.
 *
 * Split in two so the check happens before any hook runs -- `getSupport()` is a
 * plain memoized function, not a hook, and its answer cannot change during a page
 * load, so the early return is stable.
 *
 * Without this, a browser that ignores `{ type: 'module' }` on SharedWorker gives
 * an operator a board where every field looks fine and nothing ever updates, with
 * no error anywhere they would think to look. See velcro/support.js.
 */
export function StudioProvider({ studio, children, fallback = null, onUnsupported }) {
  const support = getSupport()

  if (!support.ok) {
    if (onUnsupported) return onUnsupported(support)
    return <UnsupportedPage support={support} name={studio?.name} />
  }

  return (
    <Provider studio={studio} fallback={fallback}>
      {children}
    </Provider>
  )
}
