import { useEffect, useRef } from 'react'

export const useEffectOnce = (effect) => {
  const hasRunOnce = useRef(false)

  useEffect(() => {
    if (!hasRunOnce.current) {
      effect()
      hasRunOnce.current = true
    }
  }, [effect])
}
