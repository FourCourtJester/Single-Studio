import { useCallback, useEffect, useState } from 'react'

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

/**
 * The latest mutation from this page that failed, and a way to put it away.
 *
 * A failed mutation changed nothing -- they happen completely or not at all -- so
 * this is the whole story an operator needs: which button, and why. Repeats of the
 * same failure are counted rather than stacked, because a hotkey held down is one
 * problem, not forty.
 *
 * @returns {[{ name: string, message: string, count: number } | null, () => void]}
 */
export function useMutationFailure() {
  const velcro = useVelcro()
  const [failure, setFailure] = useState(null)

  // Optional-chained for a studio testing its board against a stand-in client that
  // predates this: a missing notice is better than a board that will not mount.
  useEffect(
    () =>
      velcro.onMutationError?.((next) =>
        setFailure((current) =>
          current && current.name === next.name && current.message === next.message ? { ...current, count: current.count + 1 } : { ...next, count: 1 },
        ),
      ),
    [velcro],
  )

  const dismiss = useCallback(() => setFailure(null), [])

  return [failure, dismiss]
}
