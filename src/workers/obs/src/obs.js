// Import core components
import OBSWebSocket from 'obs-websocket-js/json'

// Import our components
import OBSUtils from 'workers/obs/utils'

const defaults = { host: '127.0.0.1', port: 4455, password: undefined, studio: 'Template' }

class Singleton {
  static #instance

  #actions = {}

  #config = {
    client: {
      connecting: false,
      connected: false,
    },
    reconnect: null,
    studio: null,
  }

  #port = new BroadcastChannel(OBSUtils.port)

  #ws

  constructor() {
    // Save the instance
    Singleton.#instance = this
  }

  // Private Functions

  #defaults(props) {
    this.#config.client.host = props?.host || defaults.host
    this.#config.client.port = props?.port || defaults.port
    this.#config.client.password = props?.password || defaults.password
    this.#config.studio = props?.studio || defaults.studio
  }

  async #import() {
    return import(`studios/${this.#config.studio}/actions/traffic`)
  }

  #listen(events = {}) {
    events.forEach(([event, fn]) => this.#ws.on(event, fn.bind(null, this.#ws)))
  }

  // Public Functions

  connect(props) {
    if (this.#config.client.connecting || this.#config.client.connected) return false

    this.#defaults(props)

    const url = `ws://${this.#config.client.host}:${this.#config.client.port}`

    this.#ws = new OBSWebSocket()

    this.#config.client.connecting = true

    this.#ws.on('ConnectionOpened', () => {
      console.log('Connection Opened')

      this.#config.client.connecting = false
      this.#config.client.connected = true
    })

    this.#ws.on('ConnectionClosed', (err) => {
      console.log('Connection Closed', err)

      clearTimeout(this.#config.reconnect)

      this.#config.client.connecting = false
      this.#config.client.connected = false

      this.#config.reconnect = setTimeout(() => this.connect(), 5 * 1000)
    })

    return this.#ws
      .connect(url, this.#config.client.password)
      .then(() => this.#import())
      .then((config) => {
        this.#actions = config.traffic.obs.actions
        this.#listen(config.traffic.obs.events)
      })
      .then(() => {
        this.#port.addEventListener('message', (response) => {
          const action = response.data

          if (this.#actions?.[action]) this.#actions[action](this.#ws)
        })
      })
      .catch((err) => console.error(err))
  }

  // Static Functions

  static getInstance() {
    return Singleton.#instance ? Singleton.#instance : new Singleton()
  }
}

export default Singleton
