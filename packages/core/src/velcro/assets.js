// The asset library: named images an operator manages during a show.
//
// Two ways in, because images arrive two ways. A file gets dropped in; a URL gets
// pasted. Both become an *entry with a key* -- "ada-okafor", "sponsor-acme" -- and
// a graphic references that key rather than a hash or a raw link. The key is what
// an operator recognises under pressure, and it means swapping which image a slot
// points at is a rename in the library, not an edit to every path using it.
//
// Two object stores, because identity and content are different questions:
//
//   entries  key -> { kind, hash | url, name, addedAt }   what the operator named
//   blobs    hash -> { blob, type, size }                 the bytes, deduplicated
//
// Splitting them means the same photo filed under two keys stores its bytes once,
// and a key can be renamed without touching the bytes at all.
//
// Bytes deliberately do NOT go in the Y.Doc. That document is persisted whole and
// structured-cloned to every tab on every change, so a few megabytes of JPEG would
// make each of those expensive, and a CRDT keeps more history than you want for a
// large value that gets replaced. The document holds `asset:<key>`.
//
// IndexedDB is per-origin, so the dock writes and every browser source reads the
// same library with no worker protocol in between.

const ENTRIES = 'entries'
const BLOBS = 'blobs'
const VERSION = 2

export const ASSET_SCHEME = 'asset:'

export const isAssetRef = (value) => typeof value === 'string' && value.startsWith(ASSET_SCHEME)
export const toAssetRef = (key) => `${ASSET_SCHEME}${key}`
export const assetKeyOf = (ref) => (isAssetRef(ref) ? ref.slice(ASSET_SCHEME.length) : null)

/** Keys are slugs: predictable to type, safe to show, stable to sort. */
export function toKey(value) {
  return String(value ?? '')
    .replace(/\.[a-z0-9]+$/i, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** SHA-256 of the bytes, hex. Content identity, so the same file stores once. */
export async function hashBytes(buffer) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer)

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

export class AssetStore {
  #name

  #db = null

  constructor(studio = 'studio') {
    this.#name = `${studio}:assets`
  }

  async open() {
    if (this.#db) return this.#db

    this.#db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.#name, VERSION)

      req.onupgradeneeded = () => {
        const db = req.result

        if (!db.objectStoreNames.contains(ENTRIES)) db.createObjectStore(ENTRIES, { keyPath: 'key' })
        if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS, { keyPath: 'hash' })
      }

      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    return this.#db
  }

  async #store(name, mode) {
    const db = await this.open()

    return db.transaction(name, mode).objectStore(name)
  }

  /** A key not already taken, suffixed only when it has to be. */
  async #freeKey(preferred) {
    const base = toKey(preferred) || 'image'
    const taken = new Set((await this.list()).map((entry) => entry.key))

    if (!taken.has(base)) return base

    let n = 2

    while (taken.has(`${base}-${n}`)) n += 1

    return `${base}-${n}`
  }

  /** Store a File or Blob under a key. Identical bytes reuse the existing blob. */
  async addFile(file, { key, name } = {}) {
    const buffer = await file.arrayBuffer()
    const hash = await hashBytes(buffer)

    if (!(await request((await this.#store(BLOBS, 'readonly')).get(hash)))) {
      await request(
        (await this.#store(BLOBS, 'readwrite')).put({
          hash,
          blob: file instanceof Blob ? file : new Blob([buffer], { type: file.type }),
          type: file.type || 'application/octet-stream',
          size: buffer.byteLength,
        }),
      )
    }

    const entry = {
      key: await this.#freeKey(key ?? file.name),
      kind: 'file',
      hash,
      name: name ?? file.name ?? 'image',
      size: buffer.byteLength,
      type: file.type || 'application/octet-stream',
      addedAt: Date.now(),
    }

    await request((await this.#store(ENTRIES, 'readwrite')).put(entry))

    return entry
  }

  /** Store a URL under a key. The bytes stay wherever they are. */
  async addUrl(url, { key, name } = {}) {
    const trimmed = String(url ?? '').trim()

    if (!trimmed) throw new Error('a URL is required')

    let derived = key

    if (!derived) {
      try {
        derived = new URL(trimmed, window.location.href).pathname.split('/').filter(Boolean).at(-1) ?? 'image'
      } catch {
        derived = 'image'
      }
    }

    const entry = {
      key: await this.#freeKey(derived),
      kind: 'url',
      url: trimmed,
      name: name ?? trimmed,
      addedAt: Date.now(),
    }

    await request((await this.#store(ENTRIES, 'readwrite')).put(entry))

    return entry
  }

  async get(key) {
    if (!key) return null

    return (await request((await this.#store(ENTRIES, 'readonly')).get(key))) ?? null
  }

  async list() {
    const entries = await request((await this.#store(ENTRIES, 'readonly')).getAll())

    return entries.sort((a, b) => a.key.localeCompare(b.key))
  }

  async blob(hash) {
    if (!hash) return null

    return (await request((await this.#store(BLOBS, 'readonly')).get(hash)))?.blob ?? null
  }

  async rename(key, next) {
    const entry = await this.get(key)

    if (!entry) return null

    const renamed = { ...entry, key: await this.#freeKey(next) }

    await request((await this.#store(ENTRIES, 'readwrite')).put(renamed))
    await request((await this.#store(ENTRIES, 'readwrite')).delete(key))

    return renamed
  }

  /**
   * Remove an entry, and its bytes if nothing else refers to them.
   *
   * Blobs are shared between entries, so deleting "ada-okafor" must not pull the
   * photo out from under "ada-headshot-alt" pointing at the same file.
   */
  async remove(key) {
    const entry = await this.get(key)

    if (!entry) return

    await request((await this.#store(ENTRIES, 'readwrite')).delete(key))

    if (entry.kind !== 'file') return

    const others = (await this.list()).filter((other) => other.hash === entry.hash)

    if (!others.length) await request((await this.#store(BLOBS, 'readwrite')).delete(entry.hash))
  }
}

// One object URL per blob per page.
//
// Not revoked while the page lives: a graphic holds a handful at most, and revoking
// one another component is still showing would blank it on air. A browser source
// set to unload when hidden tears the page down anyway, which releases them.
const urls = new Map()

/**
 * Resolve a key to something an <img> can use.
 *
 * A URL entry hands back its URL; a file entry hands back an object URL over the
 * stored bytes. Callers do not care which, which is the point of the library.
 */
export function resolveAsset(store, key) {
  if (!key) return Promise.resolve(null)
  if (urls.has(key)) return urls.get(key)

  const pending = store.get(key).then((entry) => {
    if (!entry) return null
    if (entry.kind === 'url') return entry.url

    return store.blob(entry.hash).then((blob) => (blob ? URL.createObjectURL(blob) : null))
  })

  urls.set(key, pending)

  return pending
}

/** Drop a cached resolution so a renamed or replaced entry is re-read. */
export const forgetAsset = (key) => urls.delete(key)
