/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers
// Rocket League Websocket API: https://gitlab.com/bakkesplugins/sos/sos-plugin/-/tree/master

let ws
const status = {
  connected: false,
  connecting: false,
  reconnect: null,
}
const properties = {
  listeners: {},
  parameters: {},
  ports: [],
}

// Initialization
function connect() {
  // Connect
  const { host } = properties.parameters
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

      if (!properties.listeners[data.event]) return false

      properties.ports.forEach((emit) => emit(null, data.event, { event: data.event, data: data.data }))
    } catch (err) {
      console.error(err)
    }
  })

  ws.addEventListener('close', async (msg) => {
    console.log('Connection Closed', msg)

    status.connected = false

    clearTimeout(status.reconnect)

    status.reconnect = setTimeout(() => connect(), 5 * 1000)
  })

  return true
}

// Port constructor
self.onconnect = (msgEvent) => {
  const port = msgEvent.ports[0]

  // Port Emit
  properties.ports.push((id, event, response) => port.postMessage({ id, event, response }))

  port.addEventListener('message', ({ data: { data, event, method } }) => {
    switch (method) {
      case 'connect': {
        properties.parameters = data

        if (!status.connecting && !status.connected) connect()
        break
      }

      case 'on': {
        if (properties.listeners[event] === undefined) properties.listeners[event] = 0

        properties.listeners[event] += 1
        break
      }

      case 'off': {
        properties.listeners[event] -= 1
        break
      }

      default: {
        break
      }
    }
  })

  port.start()
  console.log('Port started')
}
