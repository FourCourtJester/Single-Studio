// Import core components
// ...

// Import our components
import { Utils as VelcroUtils } from 'workers/velcro/utils'

class Singleton {
  static #instance

  #events = {}

  #port = new BroadcastChannel(VelcroUtils.port)

  constructor() {
    // Save the instance
    Singleton.#instance = this
  }

  // Public Functions

  action(name, data) {
    this.#port.postMessage({ action: name, data })
  }

  addEvent(name, fn) {
    this.#events[name] = this.#events?.[name] || new BroadcastChannel(VelcroUtils.channelName(name))
    this.#events[name].addEventListener('message', fn)
  }

  // Static Functions

  static getInstance() {
    return Singleton.#instance ? Singleton.#instance : new Singleton()
  }
}

export default Singleton
