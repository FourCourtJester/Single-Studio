/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers
// OBS Websocket API: https://github.com/obs-websocket-community-projects/obs-websocket-js
// OBS API: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md

// Import core components
// ...

// Import our components
import OBS from 'workers/obs/src/obs'

const api = OBS.getInstance()

// Port constructor
self.onconnect = (connections) => {
  const port = connections.ports[0]

  // Initiate connection
  port.onmessage = ({ data }) => {
    api.connect(data)
  }

  console.log('OBS port started')

  port.start()
}
