/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers
// Rocket League Websocket API: https://gitlab.com/bakkesplugins/sos/sos-plugin/-/tree/master

// Import core components
// ...

// Import our components
import RocketLeague from 'workers/rocket-league/src/rocket-league'

const api = RocketLeague.getInstance()

// Port constructor
self.onconnect = (connections) => {
  const port = connections.ports[0]

  // Initiate connection
  port.onmessage = ({ data }) => {
    api.connect(data)
  }

  console.log('Rocket League port started')

  port.start()
}
