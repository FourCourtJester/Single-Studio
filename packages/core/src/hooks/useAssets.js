import { useCallback, useEffect, useMemo, useState } from 'react'

import { AssetStore, assetKeyOf, forgetAsset, isAssetRef, resolveAsset } from '../velcro/assets'
import { useStudio } from '../studio/context'

/** The asset library for this studio. One store per page. */
export function useAssetStore() {
  const { studio } = useStudio()

  return useMemo(() => new AssetStore(studio.id ?? studio.name), [studio])
}

/**
 * Resolve a value to something an <img> can use.
 *
 * `asset:<key>` goes through the library; anything else -- a bundled path, a raw
 * URL -- passes straight through. A component can therefore accept any of them
 * without caring which it got.
 */
export function useAssetUrl(value) {
  const store = useAssetStore()
  const [url, setUrl] = useState(() => (isAssetRef(value) ? null : (value ?? null)))

  useEffect(() => {
    if (!isAssetRef(value)) {
      setUrl(value ?? null)
      return undefined
    }

    let live = true

    resolveAsset(store, assetKeyOf(value)).then((resolved) => {
      if (live) setUrl(resolved)
    })

    return () => {
      live = false
    }
  }, [store, value])

  return url
}

// IndexedDB has no change notification, so a write bumps a version every mounted
// library re-reads. An image added in the modal has to appear in the picker behind
// it without a reload.
let version = 0
const listeners = new Set()
const bump = () => {
  version += 1
  listeners.forEach((notify) => notify(version))
}

/** The library, plus the operations a manager UI needs. */
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

  const addFile = useCallback(
    async (file, options) => {
      const entry = await store.addFile(file, options)

      bump()

      return entry
    },
    [store],
  )

  const addUrl = useCallback(
    async (url, options) => {
      const entry = await store.addUrl(url, options)

      bump()

      return entry
    },
    [store],
  )

  const remove = useCallback(
    async (key) => {
      await store.remove(key)
      forgetAsset(key)
      bump()
    },
    [store],
  )

  const rename = useCallback(
    async (key, next) => {
      const entry = await store.rename(key, next)

      forgetAsset(key)
      bump()

      return entry
    },
    [store],
  )

  return { assets, addFile, addUrl, remove, rename, store }
}
