/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers
// Rocket League Websocket API: https://gitlab.com/bakkesplugins/sos/sos-plugin/-/tree/master

// Import core components
import * as Utils from 'toolkits/utils'

let ws
const status = {
  connected: false,
  connecting: false,
  listeners: {},
  parameters: {},
  reconnect: null,
}

// Port constructor
self.onconnect = (conections) => {
  const port = conections.ports[0]

  // Port Emit
  const emit = (id, event, response) => port.postMessage({ id, event, response })

  // OBS Connect
  const connect = () => {
    const { host } = status.parameters
    status.connecting = true

    ws = new WebSocket(host)

    ws.addEventListener('open', async () => {
      console.log('Connection Successful')

      status.connected = true
      status.connecting = false
    })

    ws.addEventListener('message', async (response) => {
      try {
        const data = JSON.parse(response.data)
        const listeners = Utils.getObjValue(status.listeners, data.event) || {}

        console.log(data.event, data.data)

        Object.values(listeners).forEach((f) => f({ event: data.event, data: data.data }))
      } catch (err) {
        console.error(err)
      }
    })

    ws.addEventListener('close', async (msg) => {
      console.log('Connection Closed', msg)

      status.connected = false

      clearTimeout(status.reconnect)

      status.reconnect = setTimeout(() => {
        connect()
      }, 5 * 1000)
    })
  }

  port.addEventListener('message', ({ data: request }) => {
    const { id, data, name, event } = request

    // console.log(request)

    switch (event) {
      case 'connect': {
        status.parameters = data

        if (!status.connecting && !status.connected) connect()
        break
      }

      case 'on': {
        Utils.setObjValue(status.listeners, `${name}.${id}`, emit.bind(this, id, name))
        break
      }

      case 'off': {
        delete status.listeners[name][id]
        break
      }

      default: {
        break
      }
    }
  })

  console.log('Port started')
  port.start()
}
