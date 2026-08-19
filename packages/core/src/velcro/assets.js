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

const slug = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Keys are slug paths: predictable to type, safe to show, stable to sort.
 *
 * The slash is the whole organisation scheme. A hundred images in one flat list is
 * a scroll an operator has to read; the same hundred as `players/…`, `logos/…`,
 * `maps/…` is a menu they can aim at. Nothing else changes -- the key is still one
 * string, a reference is still `asset:<key>`, and re-filing an image is the rename
 * that already existed.
 *
 * Each segment is slugged on its own so the separator survives, and only the last
 * one loses a file extension.
 */
export function toKey(value) {
  const parts = String(value ?? '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  if (!parts.length) return ''

  const last = parts.pop().replace(/\.[a-z0-9]+$/i, '')

  return [...parts, last].map(slug).filter(Boolean).join('/')
}

/**
 * The key an uploaded file should land under.
 *
 * `group` is what the operator typed; `relative` is where the file came from -- a
 * bare filename for a loose pick, `Headshots/Ada.jpg` for a folder.
 *
 * A typed group *renames* the folder rather than nesting inside it. Typing
 * "players" and picking a folder called "Headshots 2024" means "file these under
 * players"; `players/headshots-2024/ada` is nobody's intent, and it buries every
 * image one level below where the picker's grouping reads. Nesting deeper than the
 * top folder is kept, since that is structure the operator built on purpose.
 */
export function uploadKey(group, relative) {
  const path = String(relative ?? '')

  if (!group) return toKey(path)

  const at = path.indexOf('/')

  return toKey(`${group}/${at === -1 ? path : path.slice(at + 1)}`)
}

/** Everything before the last slash. '' when a key is ungrouped. */
export function groupOf(key) {
  const at = String(key ?? '').lastIndexOf('/')

  return at === -1 ? '' : String(key).slice(0, at)
}

/** The name inside the group. The whole key when there is no group. */
export function leafOf(key) {
  const at = String(key ?? '').lastIndexOf('/')

  return at === -1 ? String(key ?? '') : String(key).slice(at + 1)
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

  /**
   * A key not already taken, suffixed only when it has to be.
   *
   * `taken` lets a batch reserve as it goes. Without it, adding a folder re-reads
   * every entry once per file -- quadratic, and on a hundred images that is ten
   * thousand reads to answer a question the caller already knew the answer to.
   */
  async #freeKey(preferred, taken) {
    const base = toKey(preferred) || 'image'
    const used = taken ?? new Set((await this.list()).map((entry) => entry.key))

    if (!used.has(base)) return base

    // Suffix the leaf, not the path: `players/ada-2`, never `players/ada/2`.
    let n = 2

    while (used.has(`${base}-${n}`)) n += 1

    return `${base}-${n}`
  }

  /**
   * Store several files, reading one at a time.
   *
   * A folder of a hundred photos through `Promise.all(files.map(addFile))` reads
   * every one into memory at once and asks for the key list a hundred times. This
   * reads them in sequence against one snapshot of what is taken, and reports
   * progress, because a hundred files is long enough that silence looks broken.
   *
   * A file that fails is collected rather than thrown: one unreadable image in a
   * folder of a hundred should not lose the other ninety-nine.
   *
   * Takes plain `File`s or `{ file, path }` pairs. A drop knows a file's path only
   * by having walked the folder to find it, and that path is not on the File.
   */
  async addFiles(files, { group, onProgress } = {}) {
    const list = [...files]
    const taken = new Set((await this.list()).map((entry) => entry.key))
    const added = []
    const failed = []

    for (const [index, item] of list.entries()) {
      const file = item?.file ?? item
      // A folder pick carries webkitRelativePath, a walked drop carries `path`, and
      // a plain multi-select carries neither.
      const relative = item?.path || file?.webkitRelativePath || file?.name

      try {
        const entry = await this.addFile(file, { key: uploadKey(group, relative), name: file.name }, taken)

        taken.add(entry.key)
        added.push(entry)
      } catch (error) {
        failed.push({ name: file?.name ?? relative, error })
      }

      onProgress?.({ done: index + 1, total: list.length })
    }

    return { added, failed }
  }

  /** Store a File or Blob under a key. Identical bytes reuse the existing blob. */
  async addFile(file, { key, name } = {}, taken) {
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
      key: await this.#freeKey(key ?? file.name, taken),
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

  /**
   * Empty the library on this machine.
   *
   * Both stores, because leaving the blobs would be leaving the bytes -- the part
   * that takes the space -- behind an index that no longer names them. Nothing
   * would ever refer to them again and nothing would ever collect them.
   *
   * `clear()` rather than deleting the database: the database is opened once and
   * held for the life of the page, and `deleteDatabase` blocks on an open
   * connection rather than failing, so a reset would appear to do nothing and then
   * happen at some later reload.
   */
  async clear() {
    await request((await this.#store(ENTRIES, 'readwrite')).clear())
    await request((await this.#store(BLOBS, 'readwrite')).clear())
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

/** Drop every cached resolution. For the one case that invalidates all of them. */
export const forgetAssets = () => urls.clear()
