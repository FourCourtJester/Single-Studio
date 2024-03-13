// Import core components
// ...

// Import our components
// ...

class Singleton {
  static #instance

  #worker = new SharedWorker(new URL('./worker.js', import.meta.url), { name: 'rocket-league.js' } /* webpackChunkName: 'rocket-league-shared-worker.js' */)

  constructor() {
    // Start the port
    this.#worker.port.start()

    // Save the instance
    Singleton.#instance = this
  }

  // Public Functions

  connect(props) {
    this.#worker.port.postMessage(props)
  }

  // Static Functions

  static getInstance() {
    return Singleton.#instance ? Singleton.#instance : new Singleton()
  }
}

export default Singleton
