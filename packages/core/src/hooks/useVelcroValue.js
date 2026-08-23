import { useEffect, useMemo, useState } from 'react'

import { ordered } from '../toolkits/order'

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

/**
 * Everything under a namespace, as an object keyed by the part after it.
 *
 * For state that is a *set* rather than a value -- a library of images, a roster.
 * One path per member is the only conflict-free shape: two operators adding
 * different members at the same time merge, where a single path holding the whole
 * collection would lose one of them to last-write-wins.
 *
 *   const { value: assets } = useVelcroCollection('assets')
 */
export function useVelcroCollection(prefix) {
  const { value, loaded } = useVelcroState(prefix ? `${prefix}.*` : undefined)

  return { value: value ?? EMPTY, loaded }
}

/**
 * A collection in order, as `[key, value]` entries.
 *
 *   const roster = useVelcroList('variables.roster', { by: 'rank' })
 *   roster.map(([key, player]) => <li key={key}>{player.name}</li>)
 *
 * Same data as `useVelcroCollection`, sorted the same way a mutation reading it in
 * the worker would sort it -- one function, so a graphic and the studio logic
 * behind it never disagree about what "first" means.
 *
 * Ordered by member key when `by` is omitted, which is the order things were
 * appended in. Pass `by` to sort on a field of each member instead, and `desc` to
 * turn the list around.
 */
export function useVelcroList(prefix, { by, desc = false } = {}) {
  const { value } = useVelcroCollection(prefix)

  return useMemo(() => ordered(value, { by, desc }), [value, by, desc])
}

const EMPTY = {}
