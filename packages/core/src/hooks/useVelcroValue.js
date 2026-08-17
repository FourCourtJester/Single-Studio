import { useEffect, useState } from 'react'

import { useVelcro } from './useVelcro'

/**
 * Subscribe to one path. Re-renders only when that path changes.
 *
 * This is the single read primitive in the framework -- every source component
 * is a thin wrapper around it.
 */
export function useVelcroValue(path, fallback = undefined) {
  const velcro = useVelcro()
  const [value, setValue] = useState(undefined)

  useEffect(() => {
    if (!path) return undefined

    return velcro.subscribe(path, setValue)
  }, [path, velcro])

  return value === undefined ? fallback : value
}
