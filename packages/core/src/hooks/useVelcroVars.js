import { useEffect, useMemo, useState } from 'react'

import { useVelcro } from './useVelcro'

/**
 * Map paths onto CSS custom properties.
 *
 *   useVelcroVars({ '--home-color': 'variables.home.color' })
 *
 * Full paths, because this is a hook. Components take a bare `name` and a
 * `namespace`; hooks take the path those resolve to. `Scene` is the component
 * around this one, and is what a graphic should normally use -- reach for this when
 * a single scene needs custom properties from more than one namespace.
 *
 * This is the general form of driving a graphic from operator input. `Variable`
 * templates text and `Image` templates a URL, but anything a stylesheet can express
 * -- a team colour, a bar width, a corner radius, an offset -- becomes controllable
 * without the framework needing a component for it.
 *
 * Subscriptions are opened imperatively rather than with a hook per entry, because
 * the map is data and its length can change between renders.
 *
 * Paths holding nothing are omitted rather than set empty, so the `var(--x, ...)`
 * fallback in the stylesheet still applies.
 */
export function useVelcroVars(map) {
  const velcro = useVelcro()
  const [values, setValues] = useState({})

  // Entries, not the object, so an inline literal does not resubscribe every render.
  const entries = useMemo(() => Object.entries(map ?? {}), [map])
  const signature = entries.map(([property, path]) => `${property}=${path}`).join('|')

  useEffect(() => {
    if (!entries.length) return undefined

    const unsubscribes = entries.map(([property, path]) =>
      velcro.subscribe(path, (value) =>
        setValues((previous) => {
          if (value === undefined || value === '') {
            if (!(property in previous)) return previous

            const next = { ...previous }

            delete next[property]

            return next
          }

          if (previous[property] === value) return previous

          return { ...previous, [property]: String(value) }
        }),
      ),
    )

    return () => unsubscribes.forEach((stop) => stop())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, velcro])

  return values
}
