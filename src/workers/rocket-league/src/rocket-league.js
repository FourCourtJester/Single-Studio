// Import core components
// ...

// Import our components
import { Utils as VelcroUtils } from 'workers/velcro/utils'

const defaults = { host: 'localhost', port: 49122 }

class Singleton {
  static #instance

  #config = {
    client: {
      connecting: false,
      connected: false,
    },
    reconnect: null,
  }

  #port = new BroadcastChannel(VelcroUtils.port)

  #ws

  constructor() {
    // Save the instance
    Singleton.#instance = this
  }

  // Private Functions

  #defaults(props) {
    this.#config.client.host = props?.host || defaults.host
    this.#config.client.port = props?.port || defaults.port
  }

  // Public Functions

  connect(props) {
    if (this.#config.client.connecting || this.#config.client.connected) return false

    this.#defaults(props)

    const url = `ws://${this.#config.client.host}:${this.#config.client.port}`

    this.#ws = new WebSocket(url)

    this.#config.client.connecting = true

    this.#ws.addEventListener('open', async () => {
      console.log('Connection Successful')

      this.#config.client.connecting = false
      this.#config.client.connected = true
    })

    this.#ws.addEventListener('message', async (response) => {
      try {
        const data = JSON.parse(response.data)

        // console.log(data.event, data.data)

        this.#port.postMessage({ action: data.event, data: data.data })
      } catch (err) {
        console.error(err)
      }
    })

    this.#ws.addEventListener('close', async (err) => {
      console.log('Connection Closed', err)

      clearTimeout(this.#config.reconnect)

      this.#config.client.connecting = false
      this.#config.client.connected = false

      this.#config.reconnect = setTimeout(() => this.connect(), 5 * 1000)
    })
  }

  // Static Functions

  static getInstance() {
    return Singleton.#instance ? Singleton.#instance : new Singleton()
  }
}

export default Singleton
