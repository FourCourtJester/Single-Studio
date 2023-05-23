/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers
// OBS Websocket API: https://github.com/obs-websocket-community-projects/obs-websocket-js
// OBS API: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md

import OBSWebSocket from 'obs-websocket-js'

const obs = new OBSWebSocket()
obs.connect()

obs.on('Identified', () => {
  console.log('OBS is connected')
})

obs.on('ConnectionClosed', (err) => {
  console.error(err)
})

self.onconnect = (conections) => {
  const port = conections.ports[0]

  port.addEventListener('message', ({ data }) => {
    const { event, opts = {} } = data
    obs.call(event, opts).then((response) => port.postMessage(response))
  })

  port.start()
}

export default self
