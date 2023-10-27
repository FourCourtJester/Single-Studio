// Import core components
import { useMemo } from 'react'

// Import our components
import { RocketLeague } from 'workers'
import { useEffectOnce } from 'hooks'

export const useRocketLeague = () => {
  // Variables
  const rocketLeague = new RocketLeague()

  useEffectOnce(() => {
    const host = 'ws://localhost:49122'

    rocketLeague.connect({
      host,
    })
  })

  return useMemo(() => rocketLeague, [])
}
