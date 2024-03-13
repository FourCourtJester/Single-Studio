/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers

// Import core components
// ...

// Import our components
import Velcro from 'workers/velcro/src/store'

const redux = Velcro.getInstance()

// Port constructor
self.onconnect = (connections) => {
  const port = connections.ports[0]

  // Initiate connection
  port.onmessage = ({ data }) => {
    redux.connect(data).then(() => port.postMessage(data))
  }

  console.log('IDB port started')

  port.start()
}
