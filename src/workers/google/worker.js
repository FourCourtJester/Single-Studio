/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers

// Import core components
// ...

// Import our components
import Google from 'workers/google/src/google'

const api = Google.getInstance()

// Port constructor
self.onconnect = (connections) => {
  const port = connections.ports[0]

  // Initiate connection
  port.onmessage = ({ data }) => {
    api.connect(data)
  }

  console.log('Google port started')

  port.start()
}
