// Import core components
import { useCallback, useEffect, useState } from 'react'

// Import our components
import { useSettings } from 'hooks'

const worker = new SharedWorker(new URL('./worker.js', import.meta.url), { name: 'obs.js' } /* webpackChunkName: 'obs-shared-worker.js' */)

export const OBSConnector = () => {
  // Hooks
  const settings = useSettings('obs')
  // States
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const _settings = {
      connection: false,
      parameters: {
        host: undefined,
        password: undefined,
      },
      reconnect: null,
    }

    // obs.on('ConnectionOpened', () => {
    //   console.log('OBS is ready')
    // clearTimeout(settings.reconnect)
    // })

    // obs.on('ConnectionClosed', (err) => {
    //   console.error(err)
    //   settings.connection = false

    //   clearTimeout(settings.reconnect)
    //   settings.reconnect = setTimeout(() => {
    //     if (!settings.connection) connect()
    //   }, 5 * 1000)
    // })

    // Connect to OBS
    // OBS.connect()
  }, [settings])

  // useEffect(() => {
  //   const opts = {
  //     host: settings?.host || 'ws://127.0.0.1',
  //     port: settings?.port || 4455,
  //     password: settings?.password || undefined,
  //   }

  //   const packet = {
  //     event: OBSActions.CONNECT,
  //     opts: {
  //       host: `${opts.host}:${opts.port}`,
  //       password: opts.password,
  //     },
  //   }

  //   worker.port.postMessage(packet)
  // }, [settings])

  // useEffect(() => {
  //   // Start the port
  //   worker.port.start()

  //   // Add the listener
  //   worker.port.addEventListener('message', echo)

  //   // Send the connection info

  //   return () => {
  //     worker.port.removeEventListener('message', echo)
  //   }
  // })

  return null
}
