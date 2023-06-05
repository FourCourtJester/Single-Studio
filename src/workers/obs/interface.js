// Import core components
import { nanoid } from 'nanoid'

class OBSInterface {
  constructor() {
    this.worker = new SharedWorker(new URL('./worker.js', import.meta.url), { name: 'obs.js' } /* webpackChunkName: 'obs-shared-worker.js' */)
    this.listeners = {}

    // Start the port
    this.worker.port.start()

    // Add the message handler
    // this.worker.port.addEventListener('message', (response) => console.log(response))
  }

  call(event, data = {}) {
    const request = { event: 'call', data: { ...data, request: event } }
    return this.onRequest(request).catch((err) => console.error(err))
  }

  connect(data) {
    const request = { event: 'connect', data }
    return this.onRequest(request).catch((err) => console.error(err))
  }

  onRequest(request) {
    const id = nanoid(4)

    return new Promise((resolve, reject) => {
      this.listeners[id] = this.onResponse.bind(this, id, resolve)

      this.worker.port.addEventListener('message', this.listeners[id])
      this.worker.port.postMessage({ id, ...request })
    })
  }

  onResponse(id, resolve, response) {
    if (id !== response?.data?.id) return false

    this.worker.port.removeEventListener('message', this.listeners[id])
    delete this.listeners[id]

    resolve(response.data)
  }
}

export default OBSInterface
