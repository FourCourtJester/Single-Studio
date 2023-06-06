// Import core components
import { nanoid } from 'nanoid'

class OBSInterface {
  constructor() {
    this.worker = new SharedWorker(new URL('./worker.js', import.meta.url), { name: 'obs.js' } /* webpackChunkName: 'obs-shared-worker.js' */)
    this.listeners = {}
    this.requests = {}

    // Start the port
    this.worker.port.start()

    // Add the message handler
    // this.worker.port.addEventListener('message', (response) => console.log(response))
  }

  // eslint-disable-next-line class-methods-use-this
  _onEvent(id, f, response) {
    if (id !== response?.data?.id) return false
    f(response.data)
  }

  _onRequest(request) {
    const id = nanoid(4)

    return new Promise((resolve, reject) => {
      this.requests[id] = this._onResponse.bind(this, id, resolve)

      this.worker.port.addEventListener('message', this.requests[id])
      this.worker.port.postMessage({ id, ...request })
    })
  }

  _onResponse(id, resolve, response) {
    if (id !== response?.data?.id) return false

    this.worker.port.removeEventListener('message', this.requests[id])
    delete this.requests[id]

    resolve(response.data)
  }

  call(event, data = {}) {
    const request = { event: 'call', data: { ...data, request: event } }
    return this._onRequest(request).catch((err) => console.error(err))
  }

  connect(data) {
    const request = { event: 'connect', data }
    return this._onRequest(request).catch((err) => console.error(err))
  }

  on(event, f) {
    const id = nanoid(4)

    this.listeners[id] = { event, f: this._onEvent.bind(this, id, f) }

    this.worker.port.addEventListener('message', this.listeners[id].f)
    this.worker.port.postMessage({ id, event: 'on', name: event })

    return id
  }

  off(id) {
    this.worker.port.removeEventListener('message', this.listeners[id].f)
    this.worker.port.postMessage({ id, event: 'off', name: this.listeners[id].event })
    delete this.listeners[id]
  }
}

export default OBSInterface
