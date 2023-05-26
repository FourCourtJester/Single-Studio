// Import core components
import { useEffect } from 'react'

// Import our components
import { useEffectOnce, useSettings } from 'hooks'
import { OBSActions } from 'workers/obs/reducer'

const worker = new SharedWorker(new URL('./ws.js', import.meta.url), { name: 'obs.js' } /* webpackChunkName: 'obs-shared-worker.js' */)

function echo(data) {
  console.log(data)
}

export const OBSWorker = () => {
  // Redux
  const settings = useSettings('obs')

  useEffect(() => {
    const opts = {
      host: settings?.host || 'ws://127.0.0.1',
      port: settings?.port || 4455,
      password: settings?.password || undefined,
    }

    const packet = {
      event: OBSActions.CONNECT,
      opts: {
        host: `${opts.host}:${opts.port}`,
        password: opts.password,
      },
    }

    worker.port.postMessage(packet)
  }, [settings])

  useEffectOnce(() => {
    // Start the port
    worker.port.start()

    // Add the listener
    worker.port.addEventListener('message', echo)

    // Send the connection info

    return () => {
      worker.port.removeEventListener('message', echo)
    }
  })

  return null
}

// class OBSWorker {
//   constructor() {
//     console.log('Create OBSWorker')
//     this.worker = new SharedWorker(new URL('./ws.js', import.meta.url), { name: 'obs.js' } /* webpackChunkName: 'obs-shared-worker.js' */)
//     this.worker.port.start()
//   }
// }

// export default OBSWorker

// const worker = new SharedWorker(new URL('./ws.js', import.meta.url), { name: 'obs.js' } /* webpackChunkName: 'obs-shared-worker.js' */)
// worker.port.start()

// export default worker.port
