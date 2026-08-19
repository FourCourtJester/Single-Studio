import { useCallback, useEffect, useMemo, useState } from 'react'

import { AssetStore, assetKeyOf, forgetAsset, forgetAssets, isAssetRef, resolveAsset } from '../velcro/assets'
import { useStudio } from '../studio/context'
import { useVelcroCollection } from './useVelcroValue'
import { useVelcroMutate } from './useVelcroMutate'

/**
 * The library's index replicates; its bytes do not.
 *
 * An entry is a few hundred bytes of metadata and belongs in the document, where
 * every machine can see it. The image itself stays in IndexedDB on whichever
 * machines have it.
 *
 * Without this the failure is silent and lands on air. An operator picks a headshot
 * from *their* library, the reference replicates fine, the machine running OBS has
 * no bytes for that hash -- and the graphic goes out showing its fallback while the
 * operator's own screen shows the photo. Wrong in the one direction nobody can see.
 *
 * With it, every machine knows the entry exists, knows whether it holds the bytes,
 * and can say so.
 */
const INDEX = 'assets'

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
  const mutate = useVelcroMutate()
  const { value: shared } = useVelcroCollection(INDEX)
  const [local, setLocal] = useState([])
  const [tick, setTick] = useState(version)

  useEffect(() => {
    listeners.add(setTick)

    return () => listeners.delete(setTick)
  }, [])

  useEffect(() => {
    let live = true

    store.list().then((all) => {
      if (live) setLocal(all)
    })

    return () => {
      live = false
    }
  }, [store, tick])

  /**
   * What the room knows, plus what this machine can actually render.
   *
   * The replicated index decides what *exists*; the local store decides what is
   * showable here. A URL entry is showable everywhere by definition. A file entry
   * is showable only where its bytes are, and `here: false` is what lets a picker
   * say so rather than offering a choice that will go out blank.
   */
  const assets = useMemo(() => {
    const mine = new Map(local.map((entry) => [entry.key, entry]))
    const keys = new Set([...Object.keys(shared), ...mine.keys()])

    return [...keys]
      .map((key) => {
        const held = mine.get(key)
        const known = shared[key]
        const entry = { ...known, ...held, key }

        return { ...entry, here: entry.kind === 'url' ? Boolean(entry.url) : Boolean(held) }
      })
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [local, shared])

  /** Metadata only. The bytes are deliberately not in here -- see INDEX. */
  const share = useCallback(
    (entry) => {
      if (!entry) return

      const { key, kind, url, hash, name, size, type, addedAt } = entry

      mutate('set', { [`${INDEX}.${key}`]: { kind, url, hash, name, size, type, addedAt } })
    },
    [mutate],
  )

  const addFile = useCallback(
    async (file, options) => {
      const entry = await store.addFile(file, options)

      share(entry)
      bump()

      return entry
    },
    [store, share],
  )

  const addFiles = useCallback(
    async (files, options) => {
      const result = await store.addFiles(files, options)

      for (const entry of result.added) share(entry)

      bump()

      return result
    },
    [store, share],
  )

  const addUrl = useCallback(
    async (url, options) => {
      const entry = await store.addUrl(url, options)

      share(entry)
      bump()

      return entry
    },
    [store, share],
  )

  const remove = useCallback(
    async (key) => {
      await store.remove(key)
      forgetAsset(key)
      // Out of the room as well as off this machine: an entry nobody can render is
      // worse than no entry, because it is still offerable in a picker.
      mutate('unset', `${INDEX}.${key}`)
      bump()
    },
    [store, mutate],
  )

  /**
   * Empty the library, here and in the room.
   *
   * Both halves, and in that order. The bytes are local and the index replicates,
   * so clearing only the store would leave every other machine offering images that
   * no longer exist anywhere, and clearing only the index would leave the bytes
   * occupying IndexedDB with nothing able to name them.
   */
  const removeAll = useCallback(async () => {
    await store.clear()
    forgetAssets()
    mutate('clear', { prefix: INDEX })
    bump()
  }, [store, mutate])

  const rename = useCallback(
    async (key, next) => {
      const entry = await store.rename(key, next)

      forgetAsset(key)

      if (entry) {
        mutate('unset', `${INDEX}.${key}`)
        share(entry)
      }

      bump()

      return entry
    },
    [store, mutate, share],
  )

  return { assets, addFile, addFiles, addUrl, remove, removeAll, rename, store }
}
