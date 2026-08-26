// Preferences that belong to the person at the board, kept where they travel.
//
// These used to live in localStorage, which was the obvious home for something
// per-machine and small. The problem is portability: a studio's durable state is
// IndexedDB -- the document and the image library both -- and anything that can be
// exported and carried to another computer is exported from there. Settings in
// localStorage are the one thing that would not come with it, so an operator who
// moved their show to a new machine would arrive with every image and every value
// intact and their keyboard back to defaults.
//
// A separate database from `:assets` rather than another store inside it. The asset
// database is content-addressed blobs and the entries that name them; its version
// number moves when that shape changes, and settings have no business forcing a
// migration of it. A studio already spans more than one database anyway -- the
// document has its own -- so an export was always going to walk a list.
//
// Named per studio, matching assets, so one studio's export is self-contained.

const STORE = 'settings'
const VERSION = 1

const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

/**
 * A small key/value store, one row per setting.
 *
 * Deliberately not one row holding an object of everything. Two settings written at
 * once from two tabs would each read the whole blob, change their own field and
 * write it back, and the slower one would erase the other -- the classic lost
 * update, on a store whose whole point is that it survives.
 */
export class SettingsStore {
  #name

  #db = null

  constructor(studio = 'studio') {
    this.#name = `${studio}:settings`
  }

  /** The database name, which an export needs to know. */
  get name() {
    return this.#name
  }

  async open() {
    if (this.#db) return this.#db

    this.#db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.#name, VERSION)

      req.onupgradeneeded = () => {
        const db = req.result

        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' })
      }

      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    return this.#db
  }

  async #store(mode) {
    const db = await this.open()

    return db.transaction(STORE, mode).objectStore(STORE)
  }

  /**
   * One setting, or `fallback` when it has never been written.
   *
   * A read that fails is a read that returns the fallback. There is no state of the
   * world where a board should refuse to start because a preference would not load
   * -- the worst honest answer is "you get the default".
   *
   * @template T
   * @param {string} key
   * @param {T} [fallback]
   * @returns {Promise<T>}
   */
  async get(key, fallback = null) {
    try {
      const row = await request((await this.#store('readonly')).get(key))

      return row === undefined ? fallback : row.value
    } catch {
      return fallback
    }
  }

  /**
   * Write one setting.
   *
   * @param {string} key
   * @param {unknown} value
   * @returns {Promise<boolean>} Whether it was actually stored.
   */
  async set(key, value) {
    try {
      await request((await this.#store('readwrite')).put({ key, value }))

      return true
    } catch {
      // A private window, a profile with storage disabled, a quota that is full.
      // The caller has already applied the change in memory; this only decides
      // whether it outlives the tab.
      return false
    }
  }

  /**
   * Forget one setting, so it goes back to its default.
   *
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async remove(key) {
    try {
      await request((await this.#store('readwrite')).delete(key))

      return true
    } catch {
      return false
    }
  }

  /**
   * Every setting, as a plain object. What an export writes out.
   *
   * @returns {Promise<Record<string, unknown>>}
   */
  async all() {
    try {
      const rows = await request((await this.#store('readonly')).getAll())

      return Object.fromEntries(rows.map((row) => [row.key, row.value]))
    } catch {
      return {}
    }
  }

  /**
   * Replace everything with `map`. What an import reads back in.
   *
   * One transaction, so a half-applied import is not a state anybody can end up in.
   *
   * @param {Record<string, unknown>} map
   * @returns {Promise<boolean>}
   */
  async replaceAll(map) {
    try {
      const store = await this.#store('readwrite')

      await request(store.clear())
      for (const [key, value] of Object.entries(map ?? {})) store.put({ key, value })

      return true
    } catch {
      return false
    }
  }

  /** Drop every setting. Part of "reset this machine". */
  async clear() {
    try {
      await request((await this.#store('readwrite')).clear())

      return true
    } catch {
      return false
    }
  }
}
