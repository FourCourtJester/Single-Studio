import { useEffect, useState } from 'react'

import { useVelcro } from './useVelcro'

const PENDING = { value: undefined, loaded: false }

/**
 * Subscribe to one path, with an explicit loaded flag.
 *
 * The flag exists because "no value yet" and "no value" have to look different on
 * air. A browser source set to unload when hidden is destroyed and rebuilt every
 * time its scene comes back, and if a graphic paints its fallback on mount the
 * viewer sees HOME 0 flash up before the real scoreline arrives. Graphics render
 * nothing until loaded, then fade in; the fallback is for a path that is loaded
 * and genuinely empty.
 */
export function useVelcroState(path) {
  const velcro = useVelcro()
  const [state, setState] = useState(PENDING)

  useEffect(() => {
    if (!path) return undefined

    // Reset on a path change so the previous path's value is never shown under
    // the new one's name.
    setState(PENDING)

    return velcro.subscribe(path, (value) => setState({ value, loaded: true }))
  }, [path, velcro])

  return state
}

/** Just the value, with a fallback for when the path holds nothing. */
export function useVelcroValue(path, fallback = undefined) {
  const { value } = useVelcroState(path)

  return value === undefined ? fallback : value
}
