import { nanoid } from 'nanoid'

class OBSInterface {
  constructor() {
    this.worker = new SharedWorker(new URL('./worker.js', import.meta.url), { name: 'obs.js' } /* webpackChunkName: 'obs-shared-worker.js' */)
    this.queue = []
    this.connected = false

    // Start the port
    this.worker.port.start()

    // Add the message handler
    this.worker.port.addEventListener('message', this._onMessage.bind(this))
  }

  _onMessage({ data: { id, event, data } }) {
    console.log(`${event} (${id}) |`, data)

    switch (event) {
      case 'connected': {
        this.connected = true

        if (data && this.queue) {
          this.queue.forEach((request) => this.worker.port.postMessage(request))
        }
        break
      }

      case 'disconnected': {
        this.connected = false
        break
      }

      default: {
        break
      }
    }
  }

  action(event, data = {}) {
    const id = nanoid(4)

    if (event === 'connect') this.worker.port.postMessage({ id, event, data })
    else if (!this.connected) this.queue.push({ id, event, data })
    else this.worker.port.postMessage({ id, event, data })
  }
}

export default OBSInterface
