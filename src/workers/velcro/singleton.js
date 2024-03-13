// Import core components
// ...

// Import our components
import { Utils as VelcroUtils } from './utils'

class Singleton {
  static #instance

  #worker = new SharedWorker(new URL('./worker.js', import.meta.url), { name: 'velcro.js' } /* webpackChunkName: 'velcro-shared-worker.js' */)

  #port

  #initialized

  constructor() {
    // Start the port
    this.#worker.port.start()

    this.#port = new BroadcastChannel(VelcroUtils.port)

    this.#initialized = new Promise((resolve) => {
      this.#worker.port.addEventListener('message', () => resolve(), { once: true })
    })

    // Save the instance
    Singleton.#instance = this
  }

  // Private Functions

  #ready() {
    return this.#initialized
  }

  // Public Functions

  action(name, data) {
    this.#port.postMessage({ action: name, data })
  }

  connect(data) {
    return this.#worker.port.postMessage(data)
  }

  subscribe(path) {
    this.#ready().then(() => this.action('subscribe', path))
    return new BroadcastChannel(VelcroUtils.channelName(path))
  }

  unsubscribe(path, channel) {
    this.action('unsubscribe', path)
    channel.close()
  }

  // Static Functions

  static getInstance() {
    return Singleton.#instance ? Singleton.#instance : new Singleton()
  }
}

export default Singleton
