// Import core components
import { useMemo } from 'react'

// Import our components
import { OBSInterface } from 'workers'
import { useSettings } from './useSettings'
import { useEffectOnce } from './useEffectOnce'

const defaults = {
  connect: {
    host: '127.0.0.1',
    port: 4455,
    password: undefined,
  },
}

const obs = new OBSInterface()

export const useOBS = (props = {}) => {
  const { toasts = false } = props
  const settings = useSettings('obs')

  useEffectOnce(() => {
    // const obs = OBS.current
    if (!obs) return () => {}

    const host = ['ws://', settings?.host || defaults.connect.host, ':', settings?.port || defaults.connect.port].join('')

    if (toasts) {
      obs.on('Hello', (data) => console.log(data))
      obs.on('ConnectionClosed', (data) => console.error(data))
    }

    obs.connect({
      host,
      password: settings?.password || defaults.connect.host.password,
    })
  }, [settings])

  return useMemo(() => obs, [])
}
