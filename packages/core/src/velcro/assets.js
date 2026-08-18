// Operator-supplied images, stored beside the document rather than inside it.
//
// The case this exists for is a podcast guest who sends their headshot five
// minutes before air. Shipping it in the repo is not an option at that point, and
// a URL is not either -- they sent a file, not a link.
//
// Bytes deliberately do NOT go in the Y.Doc. That document is persisted whole and
// structured-cloned to every tab on every change, so a few megabytes of JPEG would
// make each of those expensive, and a CRDT keeps more history than you want for a
// large value that gets replaced. The document holds a reference; the bytes live in
// their own IndexedDB database.
//
// References are content-addressed -- `asset:<sha-256>` -- which costs nothing now
// and buys the important property later: when blobs replicate over the relay, a
// peer can tell whether it already has the bytes for a reference without
// transferring anything. Re-uploading the same file is also a no-op rather than a
// duplicate.
//
// IndexedDB is per-origin, so the dock writes and every browser source reads the
// same database with no worker protocol in between.

const STORE = 'assets'
const VERSION = 1

export const ASSET_SCHEME = 'asset:'

export const isAssetRef = (value) => typeof value === 'string' && value.startsWith(ASSET_SCHEME)
export const toAssetRef = (id) => `${ASSET_SCHEME}${id}`
export const assetIdOf = (ref) => (isAssetRef(ref) ? ref.slice(ASSET_SCHEME.length) : null)

/** SHA-256 of the bytes, hex. The asset's identity and its filename in one. */
export async function hashBytes(buffer) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer)

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Metadata without the bytes, which is all any caller outside get() wants. */
const strip = ({ blob: _blob, ...meta }) => meta

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
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
      }

      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    return this.#db
  }

  async #tx(mode) {
    const db = await this.open()

    return db.transaction(STORE, mode).objectStore(STORE)
  }

  /**
   * Store a File or Blob. Returns its metadata.
   *
   * Storing the same bytes twice returns the existing record rather than a second
   * copy -- the id *is* the content, so there is nothing to duplicate.
   */
  async put(file, { name } = {}) {
    const buffer = await file.arrayBuffer()
    const id = await hashBytes(buffer)
    const existing = await this.meta(id)

    if (existing) return existing

    const record = {
      id,
      blob: file instanceof Blob ? file : new Blob([buffer], { type: file.type }),
      name: name ?? file.name ?? id.slice(0, 8),
      type: file.type || 'application/octet-stream',
      size: buffer.byteLength,
      addedAt: Date.now(),
    }

    await request((await this.#tx('readwrite')).put(record))

    return strip(record)
  }

  async get(id) {
    if (!id) return null

    return (await request((await this.#tx('readonly')).get(id))) ?? null
  }

  async meta(id) {
    const record = await this.get(id)

    return record ? strip(record) : null
  }

  async list() {
    const records = await request((await this.#tx('readonly')).getAll())

    return records.map(strip).sort((a, b) => b.addedAt - a.addedAt)
  }

  async remove(id) {
    await request((await this.#tx('readwrite')).delete(id))
  }

  /** Drop everything not in `keep`. The store is a cache of things still referenced. */
  async prune(keep = []) {
    const kept = new Set(keep.map((ref) => assetIdOf(ref) ?? ref))
    const all = await this.list()
    const dropped = all.filter((meta) => !kept.has(meta.id))

    await Promise.all(dropped.map((meta) => this.remove(meta.id)))

    return dropped.length
  }
}

// One object URL per asset per page.
//
// Not revoked while the page lives: a graphic holds a handful of assets at most,
// and revoking one that another component is still showing would blank it on air.
// A browser source set to unload when hidden tears the whole page down anyway,
// which releases them.
const urls = new Map()

export function objectUrlFor(store, id) {
  if (!id) return Promise.resolve(null)
  if (urls.has(id)) return urls.get(id)

  const pending = store.get(id).then((record) => (record ? URL.createObjectURL(record.blob) : null))

  urls.set(id, pending)

  return pending
}
