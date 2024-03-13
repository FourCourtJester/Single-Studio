// Import core components
import { useMemo } from 'react'

// Import our components
import { RocketLeague } from 'workers'
import { useEffectOnce } from 'hooks/useEffectOnce'

export const useRocketLeague = (props = {}) => {
  const instance = RocketLeague.getInstance()

  useEffectOnce(() => {
    instance.connect(props)
  })

  return useMemo(() => instance, [instance])
}
