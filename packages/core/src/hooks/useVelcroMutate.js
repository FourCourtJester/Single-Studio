import { useCallback } from 'react'

import { useVelcro } from './useVelcro'

/**
 * Stable dispatcher for named mutations.
 *
 * The payload is optional and has to be typed as such: a mutation that needs no
 * argument is ordinary -- `mutate('demo:reset')` -- and inference made it required,
 * so every one of those was a type error in a studio that checked its own code.
 *
 * @returns {(name: string, payload?: unknown) => void} `mutate('set', { 'variables.home.score': 3 })`
 */
export function useVelcroMutate() {
  const velcro = useVelcro()

  return useCallback((name, payload) => velcro.mutate(name, payload), [velcro])
}
