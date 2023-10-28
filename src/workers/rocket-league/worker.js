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

        console.log(data.event, data.data)

        if (!status.listeners[data.event]) return false

        emit(null, data.event, { event: data.event, data: data.data })
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

  port.addEventListener('message', ({ data: { data, event, method } }) => {
    switch (method) {
      case 'connect': {
        status.parameters = data
        if (!status.connecting && !status.connected) connect()
        break
      }

      case 'on': {
        if (status.listeners[event] === undefined) status.listeners[event] = 0

        status.listeners[event] += 1
        break
      }

      case 'off': {
        status.listeners[event] -= 1
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
