// Import core components
import { Promise } from 'bluebird'
import { nanoid } from 'nanoid'

class Singleton {
  static #instance

  static #worker = new SharedWorker(
    new URL('./worker.js', import.meta.url),
    { name: 'rocket-league.js' } /* webpackChunkName: 'rocket-league-shared-worker.js' */
  )

  #listeners = {}

  constructor() {
    // eslint-disable-next-line no-constructor-return
    if (Singleton.#instance) return Singleton.#instance

    // Start the port
    Singleton.#worker.port.start()

    // Add the message handler
    Singleton.#worker.port.addEventListener('message', this.#onMessage.bind(this))

    Singleton.#instance = this
  }

  #onMessage({ data: { event, response } }) {
    if (!this.#listeners[event]) return false

    Promise.map(Object.values(this.#listeners[event]), (f) => f(response))
  }

  // eslint-disable-next-line class-methods-use-this
  connect(data) {
    Singleton.#worker.port.postMessage({ method: 'connect', data })
  }

  on(event, f) {
    const id = nanoid(4)

    if (!this.#listeners[event]) this.#listeners[event] = {}
    this.#listeners[event][id] = f

    return id
  }

  off(...ids) {
    ids.forEach((id) => {
      Object.entries(this.#listeners).forEach(([eventKey, eventListeners]) => {
        if (!eventListeners[id]) return true

        delete this.#listeners[eventKey][id]

        return false
      })
    })
  }
}

export default Singleton
