/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers
// OBS Websocket API: https://github.com/obs-websocket-community-projects/obs-websocket-js
// OBS API: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md

// Import core components
import OBSWebSocket from 'obs-websocket-js/json'

const obs = new OBSWebSocket()
const settings = {
  connected: false,
}

obs.on('ConnectionOpened', () => {
  console.log('OBS is ready')
  settings.connected = true
})

obs.on('ConnectionClosed', (err) => {
  console.error(err)
  settings.connected = false
  setTimeout(() => {
    if (!settings.connected) connect()
  }, 5 * 1000)
})

function connect() {
  obs.connect().catch((err) => console.error(err))
}

// Port constructor
self.onconnect = (conections) => {
  const port = conections.ports[0]

  if (!settings.connected) connect()

  // port.addEventListener('message', ({ data }) => {
  //   const { event, opts = {} } = data
  //   obs.call(event, opts).then((response) => port.postMessage(response))
  // })

  port.start()
}

export default self
