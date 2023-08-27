// Import core components
import { useMemo } from 'react'

// Import our components
import { PreloadInterface } from 'workers'
import { useEffectOnce } from './useEffectOnce'

const preload = new PreloadInterface()

export const usePreload = (targets = []) => {
  useEffectOnce(() => {
    if (!preload) return () => {}
    preload.fetch(targets)
  })

  return useMemo(() => preload, [])
}
