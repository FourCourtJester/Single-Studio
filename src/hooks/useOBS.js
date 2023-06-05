// Import core components
import { useEffect, useMemo, useRef } from 'react'

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

export const useOBS = () => {
  const settings = useSettings('obs')

  useEffectOnce(() => {
    // const obs = OBS.current
    if (!obs) return () => {}

    const host = ['ws://', settings?.host || defaults.connect.host, ':', settings?.port || defaults.connect.port].join('')

    obs
      .connect({
        host,
        password: settings?.password || defaults.connect.host.password,
      })
      .then((response) => {
        if (response?.error) throw response
        return response
      })
      .then((response) => console.log(response))
      .catch((err) => console.error(err))
  }, [settings])

  return useMemo(() => obs, [])
}
