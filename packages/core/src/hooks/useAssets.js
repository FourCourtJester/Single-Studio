import { useCallback, useEffect, useMemo, useState } from 'react'

import { AssetStore, assetIdOf, isAssetRef, objectUrlFor } from '../velcro/assets'
import { useStudio } from '../studio/context'

/** The asset store for this studio. One per page. */
export function useAssetStore() {
  const { studio } = useStudio()

  return useMemo(() => new AssetStore(studio.id ?? studio.name), [studio])
}

/**
 * Resolve an `asset:<hash>` reference to something an <img> can use.
 *
 * Anything that is not an asset reference passes straight through, so a component
 * can accept a URL, a bundled path, or an operator's upload without caring which.
 */
export function useAssetUrl(ref) {
  const store = useAssetStore()
  const [url, setUrl] = useState(() => (isAssetRef(ref) ? null : (ref ?? null)))

  useEffect(() => {
    if (!isAssetRef(ref)) {
      setUrl(ref ?? null)
      return undefined
    }

    let live = true

    objectUrlFor(store, assetIdOf(ref)).then((resolved) => {
      if (live) setUrl(resolved)
    })

    return () => {
      live = false
    }
  }, [ref, store])

  return url
}

/**
 * The stored library, for a picker.
 *
 * `version` bumps on every write so every mounted picker re-reads -- IndexedDB has
 * no change notification of its own, and a guest added on one panel should appear
 * on another without a reload.
 */
let version = 0
const listeners = new Set()
const bump = () => {
  version += 1
  listeners.forEach((fn) => fn(version))
}

export function useAssetLibrary() {
  const store = useAssetStore()
  const [assets, setAssets] = useState([])
  const [tick, setTick] = useState(version)

  useEffect(() => {
    listeners.add(setTick)

    return () => listeners.delete(setTick)
  }, [])

  useEffect(() => {
    let live = true

    store.list().then((all) => {
      if (live) setAssets(all)
    })

    return () => {
      live = false
    }
  }, [store, tick])

  const add = useCallback(
    async (file) => {
      const meta = await store.put(file)

      bump()

      return meta
    },
    [store],
  )

  const remove = useCallback(
    async (id) => {
      await store.remove(id)
      bump()
    },
    [store],
  )

  return { assets, add, remove, store }
}
