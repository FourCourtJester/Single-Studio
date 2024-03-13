// Import core components
import { isEmpty, isEqual, isObject } from 'lodash'
import Promise from 'bluebird'

// Import our components
import * as Utils from 'toolkits/utils'

const version = 1
const stores = ['timers', 'toggles', 'variables']

class IDBBase {
  #config = {
    db: {
      connected: false,
      studio: 'Unnamed',
    },
  }

  #db

  #stores = {}

  constructor(studio) {
    Utils.setObjValue(this.#config, 'db.studio', studio)
  }

  // Private Functions

  #clear({ resolve, reject }) {
    return Promise.map(
      [...this.#db.objectStoreNames],
      (store) =>
        new Promise((_resolve, _reject) => {
          const transaction = this.#db.transaction(store, 'readwrite')
          const objStore = transaction.objectStore(store)
          const data = objStore.clear()

          transaction.oncomplete = () => _resolve()
          transaction.onerror = (e) => _reject(e.target.error)

          data.onerror = (e) => _reject(e.target.error)
        })
    )
      .then(() => resolve())
      .catch((err) => reject(err))
  }

  #delete({ key, resolve, reject }) {
    const [store, ..._ndex] = key.split('.')
    const ndex = _ndex.join('.')
    const transaction = this.#db.transaction(store, 'readwrite')
    const objStore = transaction.objectStore(store)
    const range = IDBKeyRange.bound(ndex, `${ndex}\uFFFF`, false, true)
    const data = objStore.openCursor(range)
    const result = []

    data.onerror = (e) => reject(e.target.error)
    data.onsuccess = (e) => {
      const cursor = e.target.result

      if (!cursor) return resolve(result)

      const request = cursor.delete()

      request.onerror = (ee) => reject(ee.target.error)
      request.onsuccess = () => result.push([store, cursor.key].join('.'))

      cursor.continue()
    }
  }

  #increment({ key, value, resolve, reject }) {
    return this.get(key)
      .then((cache) => this.update(Utils.setObjValue({}, key, cache + value)))
      .then(() => resolve())
      .catch((err) => reject(err))
  }

  #range({ key, resolve, reject }) {
    const [store, ..._ndex] = key.split('.')
    const ndex = _ndex.join('.')
    const transaction = this.#db.transaction(store, 'readonly')
    const objStore = transaction.objectStore(store)
    const range = IDBKeyRange.bound(ndex, `${ndex}\uFFFF`, false, true)
    const data = objStore.openCursor(range)
    const result = {}

    data.onerror = (e) => reject(e.target.error)
    data.onsuccess = (e) => {
      const cursor = e.target.result

      if (!cursor) return resolve(Utils.getObjValue(result, ndex))

      Utils.setObjValue(result, cursor.key, cursor.value)
      cursor.continue()
    }
  }

  #read({ key, resolve, reject }) {
    const [store, ..._ndex] = key.split('.')
    const ndex = _ndex.join('.')
    const transaction = this.#db.transaction(store, 'readonly')
    const objStore = transaction.objectStore(store)
    const data = objStore.get(ndex)

    data.onerror = (e) => reject(e.target.error)
    data.onsuccess = (e) => resolve(e.target.result)
  }

  #readAll({ resolve, reject }) {
    return Promise.map(
      [...this.#db.objectStoreNames],
      (store) =>
        new Promise((_resolve, _reject) => {
          const transaction = this.#db.transaction(store, 'readonly')
          const objStore = transaction.objectStore(store)
          const data = objStore.openCursor()
          const result = {}

          transaction.oncomplete = () => _resolve({ [store]: result })
          transaction.onerror = (e) => _reject(e.target.error)

          data.onerror = (e) => _reject(e.target.error)
          data.onsuccess = (e) => {
            const cursor = e.target.result

            if (cursor) {
              Utils.setObjValue(result, cursor.key, cursor.value)
              cursor.continue()
            }
          }
        })
    )
      .then((results) => resolve(results))
      .catch((err) => reject(err))
  }

  #swap({ from, to, entries, resolve, reject }) {
    const [store, ..._fromIndex] = from.split('.')
    const [, ..._toIndex] = to.split('.')

    const fromIndex = _fromIndex.join('.')
    const toIndex = _toIndex.join('.')

    const transaction = this.#db.transaction(store, 'readwrite')
    const objStore = transaction.objectStore(store)
    const range = IDBKeyRange.bound(fromIndex, `${fromIndex}\uFFFF`, false, true)
    const data = objStore.openCursor(range)
    const result = []

    data.onerror = (e) => reject(e.target.error)
    data.onsuccess = (e) => {
      const cursor = e.target.result

      if (!cursor) {
        Promise.map(
          Object.entries(entries),
          ([danglingKey, danglingVal]) =>
            new Promise((rresolve, rreject) => {
              const danglingIndex = danglingKey.replace(toIndex, fromIndex)
              const danglingUpdateRequest = objStore.put(danglingVal, danglingIndex)

              danglingUpdateRequest.onerror = (ee) => rreject(ee.target.error)
              danglingUpdateRequest.onsuccess = () => {
                const danglingDeleteRequest = objStore.delete(danglingKey)

                danglingDeleteRequest.onerror = (ee) => rreject(ee.target.error)
                danglingDeleteRequest.onsuccess = () => {
                  result.push([store, danglingKey].join('.'))
                  rresolve()
                }

                result.push([store, danglingIndex].join('.'))
              }
            })
        )
          .then(() => resolve(result))
          .catch((err) => reject(err))

        return true
      }

      const entryIndex = cursor.key.replace(fromIndex, toIndex)
      const val = entries[entryIndex]

      const cursorRequest = val ? cursor.update(val) : cursor.delete()
      const request = objStore.put(cursor.value, entryIndex)

      delete entries[entryIndex]

      cursorRequest.onerror = (ee) => reject(ee.target.error)
      cursorRequest.onsuccess = () => result.push([store, cursor.key].join('.'))

      request.onerror = (ee) => reject(ee.target.error)
      request.onsuccess = () => result.push([store, entryIndex].join('.'))

      cursor.continue()
    }
  }

  #write({ key, value, resolve, reject }) {
    const [store, ..._ndex] = key.split('.')
    const ndex = _ndex.join('.')
    const transaction = this.#db.transaction(store, 'readwrite')
    const objStore = transaction.objectStore(store)
    const data = objStore.get(ndex)

    data.onerror = (e) => reject(e.target.error)
    data.onsuccess = (e) => {
      const cache = e.target.result

      // if (cache === value) return resolve({ key, value })
      if (isEqual(cache, value)) return resolve({ key, value })

      // console.log(key, cache, value)

      const request = value ? objStore.put(value, ndex) : objStore.delete(ndex)

      request.onerror = (ee) => reject(ee.target.error)
      request.onsuccess = () => resolve({ key, value, updated: true })
    }
  }

  // Public Functions

  add(data) {
    return this.update(data)
  }

  clear() {
    return new Promise((resolve, reject) => {
      this.#clear({ resolve, reject })
    }).catch((err) => console.error(err))
  }

  connect() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(Utils.getObjValue(this.#config, 'db.studio'), version)

      request.onerror = (err) => reject(err)
      request.onsuccess = (e) => {
        Utils.setObjValue(this.#config, 'db.connected', true)
        this.#db = e.target.result
        resolve()
      }

      request.onupgradeneeded = (e) => {
        stores.forEach((store) => Utils.setObjValue(this.#stores, store, e.target.result.createObjectStore(store)))
      }
    }).catch((err) => console.error(err))
  }

  isConnected() {
    return this.#config.db.connected
  }

  get(key) {
    return new Promise((resolve, reject) => {
      this.#read({ key, resolve, reject })
    }).catch((err) => console.error(err))
  }

  getAll() {
    return new Promise((resolve, reject) => {
      this.#readAll({ resolve, reject })
    }).catch((err) => console.error(err))
  }

  increment(data) {
    const promises = []

    Utils.getObjPaths(data, (key, value) => {
      promises.push(
        new Promise((resolve, reject) => {
          this.#increment({ key, value, resolve, reject })
        })
      )
    })

    return Promise.all(promises).catch((err) => console.error(err))
  }

  range(key) {
    return new Promise((resolve, reject) => {
      this.#range({ key, resolve, reject })
    }).catch((err) => console.error(err))
  }

  remove(keys) {
    return Promise.map(
      keys,
      (key) =>
        new Promise((resolve, reject) => {
          this.#delete({ key, resolve, reject })
        })
    )
      .then((results) => results.flat())
      .catch((err) => console.error(err))
  }

  swap(keys) {
    const pairs = []

    for (let i = 0; i < keys.length / 2; i += 1) {
      pairs.push([keys.at(i), keys.at(-i - 1)])
    }

    return Promise.map(pairs, ([from, to]) =>
      this.range(to).then((results) => {
        const entries = {}

        Utils.getObjPaths(results, (key, val) => {
          const kkey = `${to}.${key}`.split('.').slice(1).join('.')
          entries[kkey] = val
        })

        return new Promise((resolve, reject) => {
          this.#swap({ from, to, entries, resolve, reject })
        })
      })
    ).catch((err) => console.error(err))
  }

  update(data) {
    const promises = []

    Utils.getObjPaths(data, (key, value) => {
      // Ignore empty scopes
      if (isObject(value) && isEmpty(value)) return false

      promises.push(
        new Promise((resolve, reject) => {
          this.#write({ key, value: value && value.toString().length ? value : undefined, resolve, reject })
        })
      )
    })

    return Promise.all(promises).catch((err) => console.error(err))
  }
}

export default IDBBase
