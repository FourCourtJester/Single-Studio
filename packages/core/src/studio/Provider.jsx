import { useEffect, useMemo, useState } from 'react'

import { createVelcroClient } from '../velcro/client'
import { StudioContext } from './context'

/**
 * Owns the one Velcro client for this page and hands it to the tree.
 *
 * Deliberately not a module-level singleton: passing it through context keeps
 * the store injectable, which is what makes components testable without a
 * SharedWorker.
 */
export function StudioProvider({ studio, children, fallback = null }) {
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

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}
