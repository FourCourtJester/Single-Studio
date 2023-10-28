// Import core components
import { Promise } from 'bluebird'
import { nanoid } from 'nanoid'

class Singleton {
  static #instance

  static #worker = new SharedWorker(new URL('./worker.js', import.meta.url), { name: 'obs.js' } /* webpackChunkName: 'obs-shared-worker.js' */)

  #listeners = {}

  #requests = {}

  constructor() {
    // eslint-disable-next-line no-constructor-return
    if (Singleton.#instance) return Singleton.#instance

    // Start the port
    Singleton.#worker.port.start()

    // Add the message handler
    Singleton.#worker.port.addEventListener('message', this.#onMessage.bind(this))

    Singleton.#instance = this
  }

  #onMessage({ data: { id, event, response } }) {
    // Responses
    if (id) this.#requests[id](response)

    // Events
    if (this.#listeners[event]) Promise.map(Object.values(this.#listeners[event]), (f) => f(response))
  }

  #onRequest(request) {
    const id = nanoid(4)

    return new Promise((resolve, _) => {
      this.#requests[id] = this.#onResponse.bind(this, id, resolve)
      Singleton.#worker.port.postMessage({ id, ...request })
    })
  }

  #onResponse(id, resolve, response) {
    delete this.#requests[id]
    resolve(response)
  }

  call(event, data = {}) {
    return this.#onRequest({ method: 'call', data: { request: event, data } }).catch((err) => console.error(err))
  }

  callBatch(data) {
    return this.#onRequest({ method: 'callBatch', data }).catch((err) => console.error(err))
  }

  connect(data) {
    return this.#onRequest({ method: 'connect', data }).catch((err) => console.error(err))
  }

  on(event, f) {
    const id = nanoid(4)

    if (!this.#listeners[event]) this.#listeners[event] = {}
    this.#listeners[event][id] = f

    Singleton.#worker.port.postMessage({ method: 'on', event })

    return id
  }

  off(...ids) {
    ids.forEach((id) => {
      Object.entries(this.#listeners).forEach(([eventKey, eventListeners]) => {
        if (!eventListeners[id]) return true

        Singleton.#worker.port.postMessage({ method: 'off', event: eventKey })
        delete this.#listeners[eventKey][id]

        return false
      })
    })
  }
}

export default Singleton
