// Import core components
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
    // Singleton.#worker.port.addEventListener('message', (response) => console.log(response))

    Singleton.#instance = this
  }

  // eslint-disable-next-line class-methods-use-this
  #onEvent(id, f, { data: { id: responseID, response } }) {
    return id !== responseID ? false : f(response)
  }

  #onRequest(request) {
    const id = nanoid(4)

    return new Promise((resolve, _) => {
      this.#requests[id] = this.#onResponse.bind(this, id, resolve)

      Singleton.#worker.port.addEventListener('message', this.#requests[id])
      Singleton.#worker.port.postMessage({ id, ...request })
    })
  }

  #onResponse(id, resolve, { data: { id: responseID, response } }) {
    if (id !== responseID) return false

    Singleton.#worker.port.removeEventListener('message', this.#requests[id])
    delete this.#requests[id]

    resolve(response)
  }

  call(event, data = {}) {
    const request = { event: 'call', data: { request: event, data } }
    return this.#onRequest(request).catch((err) => console.error(err))
  }

  callBatch(data) {
    const request = { event: 'callBatch', data }
    return this.#onRequest(request).catch((err) => console.error(err))
  }

  connect(data) {
    const request = { event: 'connect', data }
    return this.#onRequest(request).catch((err) => console.error(err))
  }

  on(event, f) {
    const id = nanoid(4)

    this.#listeners[id] = { event, f: this.#onEvent.bind(this, id, f) }

    Singleton.#worker.port.addEventListener('message', this.#listeners[id].f)
    Singleton.#worker.port.postMessage({ id, event: 'on', name: event })

    return id
  }

  off(...ids) {
    ids.forEach((id) => {
      Singleton.#worker.port.removeEventListener('message', this.#listeners[id].f)
      Singleton.#worker.port.postMessage({ id, event: 'off', name: this.#listeners[id].event })
      delete this.#listeners[id]
    })
  }
}

export default Singleton
