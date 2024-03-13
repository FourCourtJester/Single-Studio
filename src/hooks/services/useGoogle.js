// Import core components
import { useMemo } from 'react'

// Import our components
import { Google } from 'workers'
import { useEffectOnce } from '../useEffectOnce'

export const useGoogle = (props = {}) => {
  const instance = Google.getInstance()

  useEffectOnce(() => {
    instance.connect(props)
  })

  return useMemo(() => instance, [instance])
}
