/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers
// OBS Websocket API: https://github.com/obs-websocket-community-projects/obs-websocket-js
// OBS API: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md

// Import core components
import OBSWebSocket from 'obs-websocket-js/json'
import { OBSActions } from 'workers/obs/reducer'

const obs = new OBSWebSocket()
const settings = {
  connection: false,
  parameters: {
    host: undefined,
    password: undefined,
  },
  reconnect: null,
}

obs.on('ConnectionOpened', () => {
  console.log('OBS is ready')
  clearTimeout(settings.reconnect)
})

obs.on('ConnectionClosed', (err) => {
  console.error(err)
  settings.connection = false

  clearTimeout(settings.reconnect)
  settings.reconnect = setTimeout(() => {
    if (!settings.connection) connect()
  }, 5 * 1000)
})

function connect() {
  settings.connection = true
  obs.connect(settings.parameters.host, settings.parameters.password).catch((err) => console.error(err))
}

function reducer({ data }) {
  const { event, opts = {} } = data
  console.log(event, opts)

  switch (event) {
    // Connect
    case OBSActions.CONNECT: {
      settings.parameters = { ...opts }

      if (!settings.connection) connect()
      break
    }

    // OBS Request Type
    default: {
      break
    }
  }

  // obs.call(event, opts).then((response) => port.postMessage(response))
}

// Port constructor
self.onconnect = (conections) => {
  const port = conections.ports[0]

  port.addEventListener('message', reducer)

  port.start()
}

export default self
