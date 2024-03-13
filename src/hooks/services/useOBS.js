// Import core components
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

// Import our components
import { OBS } from 'workers'
import { useEffectOnce } from 'hooks/useEffectOnce'

export const useOBS = (props = {}) => {
  const instance = OBS.getInstance()
  const params = useParams()

  useEffectOnce(() => {
    instance.connect({ ...props, studio: params.code })
  })

  return useMemo(() => instance, [instance])
}
