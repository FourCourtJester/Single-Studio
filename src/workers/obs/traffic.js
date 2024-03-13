// Import core components
// ...

// Import our components
import { Utils as OBSUtils } from 'workers/obs/utils'

class Singleton {
  static #instance

  #actions = {}

  #events = []

  port = new BroadcastChannel(OBSUtils.port)

  constructor() {
    // Save the instance
    Singleton.#instance = this
  }

  // Public Functions

  addAction(action, fn) {
    this.#actions[action] = fn
  }

  addEvent(event, fn) {
    this.#events.push([event, fn])
  }

  getActions() {
    return this.#actions
  }

  getEvents() {
    return this.#events
  }

  // Static Functions

  static getInstance() {
    return Singleton.#instance ? Singleton.#instance : new Singleton()
  }
}

export default Singleton
