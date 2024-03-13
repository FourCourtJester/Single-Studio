// Import core components
import { configureStore } from '@reduxjs/toolkit'

// Import our components
import { Utils as VelcroUtils } from 'workers/velcro/utils'
import createSlice from 'workers/velcro/src/slice'
import IDB from 'workers/velcro/idb/base'

const cacheInterval = 5 * 1000

class Singleton {
  static #instance

  #actions = {}

  #store

  #studio

  #idb

  #initialized = false

  #port = new BroadcastChannel(VelcroUtils.port)

  #t = setInterval(this.#cache.bind(this), cacheInterval)

  constructor() {
    // Save the instance
    Singleton.#instance = this
  }

  // Private Functions

  #cache() {
    const state = this.#store.getState()

    return this.#idb
      .clear()
      .then(() => this.#idb.update(state.idb))
      .catch((err) => {
        console.error(err)
      })
  }

  async #import() {
    const globalConfig = await import('workers/velcro/src')
    const localConfig = await import(`studios/${this.#studio}/actions`)

    return [globalConfig || {}, localConfig || {}]
  }

  // Public Functions

  connect(studio) {
    if (this.#initialized) return Promise.resolve(true)

    this.#initialized = true
    this.#studio = studio

    return Promise.resolve()
      .then(() => this.#import())
      .then((configs) => {
        const config = configs.reduce((obj, c) => ({ ...obj, ...c }), {})
        const slice = createSlice('idb', {}, config.extraReducers || {})

        this.#store = configureStore({
          middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(config.middlewares),
          reducer: {
            [slice.name]: slice.reducer,
          },
        })

        this.#actions = { ...slice.actions, ...config.actions }
      })
      .then(() => {
        this.#port.addEventListener('message', (response) => {
          const { action, data } = response.data

          if (this.#actions?.[action]) this.#store.dispatch(this.#actions[action](data))
        })
      })
      .then(() => {
        this.#idb = new IDB(studio)

        return this.#idb
          .connect()
          .then(() => this.#idb.getAll())
          .then((results) => {
            const { update } = this.#actions

            return results.forEach((store) => {
              this.#store.dispatch(update(store))
            })
          })
          .then(() => console.log('Velcro ready'))
      })
      .catch((err) => console.error(err))
  }

  static getInstance() {
    return Singleton.#instance ? Singleton.#instance : new Singleton()
  }
}

export default Singleton
