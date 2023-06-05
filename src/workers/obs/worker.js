/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers
// OBS Websocket API: https://github.com/obs-websocket-community-projects/obs-websocket-js
// OBS API: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md

// Import core components
import OBSWebSocket from 'obs-websocket-js/json'

const obs = new OBSWebSocket()
const status = {
  parameters: {},
  connected: false,
  // connection: false,
  reconnect: null,
}

obs.on('ConnectionOpened', () => {
  console.log('Connection Opened')
  clearTimeout(status.reconnect)
})

obs.on('ConnectionClosed', () => {
  console.log('Connection Closed')
  status.connected = false
  // status.connection = false

  clearTimeout(status.reconnect)
  status.reconnect = setTimeout(() => {
    // if (!status.connection) connect()
    connect()
  }, 5 * 1000)
})

function connect() {
  // const connected = !!status.connection
  // status.connection = true

  // return !connected ? obs.connect(...Object.values(status.parameters)) : Promise.resolve(false)
  const { host, password } = status.parameters
  return obs.connect(host, password)
}

// Port constructor
self.onconnect = (conections) => {
  const port = conections.ports[0]

  console.log('port started')

  port.addEventListener('message', ({ data: request }) => {
    const { id, data, name, event } = request

    console.log(request)

    switch (event) {
      case 'connect': {
        status.parameters = data

        connect().then((response) => {
          status.connected = true
          port.postMessage({ id, event: 'connected', data: response })
        })
        break
      }

      case 'on': {
        obs.on(name, (response) => port.postMessage({ id, name, data: response }))
        break
      }

      default: {
        if (status.connected) obs?.[event](...Object.values(data)).then((response) => port.postMessage({ id, event: data.request, data: response }))
        else port.postMessage({ id, event, error: { code: 0, error: 'OBS Studio is not connected' } })
        break
      }
    }
  })

  port.start()

  // obs.on('Hello', () => {
  //   status.connected = true
  //   port.postMessage({ event: 'connected', data: status.connected })
  // })

  obs.on('ConnectionClosed', (err) => {
    port.postMessage({ event: 'disconnected', data: err })
  })
}
