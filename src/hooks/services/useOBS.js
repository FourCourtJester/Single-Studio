// Import core components
import { useMemo } from 'react'

// Import our components
import { OBS } from 'workers'
import { useSettings, useEffectOnce } from 'hooks'

const defaults = {
  connect: {
    host: '127.0.0.1',
    port: 4455,
    password: undefined,
  },
}

export const useOBS = (props = {}) => {
  // Properties
  const { toasts = false } = props
  // Hooks
  const settings = useSettings('obs')
  // Variables
  const obs = new OBS()

  useEffectOnce(() => {
    const host = ['ws://', settings?.host || defaults.connect.host, ':', settings?.port || defaults.connect.port].join('')

    if (toasts) {
      obs.on('Hello', (data) => console.log(data))
      obs.on('ConnectionClosed', (data) => console.error(data))
    }

    obs.connect({
      host,
      password: settings?.password || defaults.connect.host.password,
    })
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => obs, [])
}
