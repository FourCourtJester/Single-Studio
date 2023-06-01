// Import core components
import { useEffect, useMemo, useRef } from 'react'

// Import our components
import { OBSInterface } from 'workers'
import { useSettings } from './useSettings'

const defaults = {
  connect: {
    host: '127.0.0.1',
    port: 4455,
    password: undefined,
  },
}

export const useOBS = () => {
  const OBS = useRef(new OBSInterface())
  const settings = useSettings('obs')

  useEffect(() => {
    const obs = OBS.current
    if (!obs) return () => {}

    if (!obs.connected) {
      const host = ['ws://', settings?.host || defaults.connect.host, ':', settings?.port || defaults.connect.port].join('')

      obs.action('connect', {
        host,
        password: settings?.password || defaults.connect.host.password,
      })
    }
  }, [settings, OBS])

  return useMemo(() => OBS.current, [OBS])
}
