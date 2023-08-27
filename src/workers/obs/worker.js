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
  listeners: {},
  parameters: {},
  reconnect: null,
}

// Port constructor
self.onconnect = (connections) => {
  const port = connections.ports[0]

  // Port Emit
  const emit = (id, event, response) => port.postMessage({ id, event, response })

  // OBS Connect
  const connect = () => {
    const { host, password } = status.parameters
    status.connecting = true

    return obs.connect(host, password).then((response) => {
      console.log('Connection Successful')

      status.connected = true
      status.connecting = false

      // emit(null, 'connected', response)
    })
  }

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

  port.addEventListener('message', ({ data: request }) => {
    const { id, data, name, event } = request

    console.log(request)

    switch (event) {
      case 'callBatch': {
        if (status.connected) obs?.[event](data).then((response) => emit(id, 'batch', response))
        else emit(id, event, { code: 0, error: 'OBS Studio is not connected' })
        break
      }

      case 'connect': {
        status.parameters = data

        if (!status.connecting && !status.connected) connect()
        break
      }

      case 'on': {
        status.listeners[id] = emit.bind(this, id, name)
        obs.on(name, status.listeners[id])
        break
      }

      case 'off': {
        obs.off(name, status.listeners[id])
        delete status.listeners[id]
        break
      }

      default: {
        if (status.connected) obs?.[event](...Object.values(data)).then((response) => emit(id, data.request, response))
        else emit(id, event, { code: 0, error: 'OBS Studio is not connected' })
        break
      }
    }
  })

  console.log('port started')
  port.start()
}
