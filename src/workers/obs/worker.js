/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers
// OBS Websocket API: https://github.com/obs-websocket-community-projects/obs-websocket-js
// OBS API: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md

// Import core components
import OBSWebSocket from 'obs-websocket-js/json'

const obs = new OBSWebSocket()
const status = {
  connected: false,
  connecting: false,
  reconnect: null,
}
const properties = {
  listeners: {},
  parameters: {},
}

// Initialization
const connect = () => {
  const { host, password } = properties.parameters
  status.connecting = true

  return obs.connect(host, password).then(() => {
    console.log('Connection Successful')

    status.connected = true
    status.connecting = false

    // emit(null, 'connected', response)
  })
}

// Port constructor
self.onconnect = (connections) => {
  const port = connections.ports[0]

  // Port Emit
  const emit = (id, event, response) => port.postMessage({ id, event, response })

  // OBS Connection Opened
  obs.on('ConnectionOpened', () => {
    console.log('Connection Opened')
    clearTimeout(status.reconnect)
  })

  // OBS Disconnect
  obs.on('ConnectionClosed', (err) => {
    console.log('Connection Closed')

    status.connected = false

    // emit(null, 'disconnected', err)

    clearTimeout(status.reconnect)

    status.reconnect = setTimeout(() => {
      connect()
    }, 5 * 1000)
  })

  // obs.on('Hello', () => {
  //   status.connected = true
  //   port.postMessage({ event: 'connected', data: status.connected })
  // })

  port.addEventListener('message', ({ data: { data, event, id, method } }) => {
    switch (method) {
      case 'callBatch': {
        if (status.connected) obs?.[method](data).then((response) => emit(id, 'batch', response))
        else emit(id, method, { code: 0, error: 'OBS Studio is not connected' })
        break
      }

      case 'connect': {
        properties.parameters = data
        if (!status.connecting && !status.connected) connect()
        break
      }

      case 'on': {
        if (properties.listeners[event] === undefined) properties.listeners[event] = 0
        if (!properties.listeners[event]) obs.on(event, emit.bind(this, null, event))

        properties.listeners[event] += 1
        break
      }

      case 'off': {
        properties.listeners[event] -= 1
        if (!properties.listeners[event]) obs.off(event)
        break
      }

      default: {
        if (status.connected) obs?.[method](...Object.values(data)).then((response) => emit(id, data.request, response))
        else emit(id, method, { code: 0, error: 'OBS Studio is not connected' })
        break
      }
    }
  })

  console.log('port started')
  port.start()
}
