import { useCallback } from 'react'

import { useVelcro } from './useVelcro'

/** Stable dispatcher for named mutations. */
export function useVelcroMutate() {
  const velcro = useVelcro()

  return useCallback((name, payload) => velcro.mutate(name, payload), [velcro])
}
