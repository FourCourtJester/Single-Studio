/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers
// OBS Websocket API: https://github.com/obs-websocket-community-projects/obs-websocket-js
// OBS API: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md

// Import core components
import OBSWebSocket from 'obs-websocket-js/json'

const obs = new OBSWebSocket()
const status = {
  parameters: {},
  connection: false,
  reconnect: null,
}

obs.on('ConnectionOpened', () => {
  console.log('Connection Opened')
  clearTimeout(status.reconnect)
})

obs.on('ConnectionClosed', () => {
  console.log('Connection Closed')
  status.connection = false

  clearTimeout(status.reconnect)
  status.reconnect = setTimeout(() => {
    if (!status.connection) connect()
  }, 5 * 1000)
})

function connect() {
  const connected = !!status.connection
  status.connection = true

  return !connected ? obs.connect(...Object.values(status.parameters)) : Promise.resolve(false)
}

// Port constructor
self.onconnect = (conections) => {
  const port = conections.ports[0]

  console.log('port started')

  port.addEventListener('message', ({ data: { id, event, data } }) => {
    console.log(id, event, data)
    switch (event) {
      case 'connect': {
        status.parameters = data
        connect()
        break
      }

      default: {
        obs?.[event](...Object.values(data)).then((response) => port.postMessage({ id, event, data: response }))
        break
      }
    }
  })

  port.start()

  obs.on('Hello', () => {
    port.postMessage({ event: 'connected', data: true })
  })

  obs.on('ConnectionClosed', (err) => {
    port.postMessage({ event: 'disconnected', data: err })
  })
}
