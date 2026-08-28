import { useCallback, useEffect, useState } from 'react'

import { useVelcro } from './useVelcro'

/**
 * What plugins this studio has, and the way to configure one.
 *
 * The list comes from the worker rather than from anything the page declares,
 * because the worker is where plugins are registered. A board holding its own copy
 * would be a second place to edit and a second place to be wrong -- and it would
 * be wrong in the way that is hardest to see, showing a settings form for a plugin
 * that is not running.
 *
 * @returns {{ plugins: Array<object>, loading: boolean, configure: (name: string, values: Record<string, unknown>) => Promise<{ok: boolean, reason?: string}>, refresh: () => void }}
 */
export function usePlugins() {
  const velcro = useVelcro()
  const [plugins, setPlugins] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    let live = true

    velcro
      .plugins()
      .then((list) => {
        if (!live) return

        setPlugins(Array.isArray(list) ? list : [])
        setLoading(false)
      })
      .catch(() => {
        if (live) setLoading(false)
      })

    return () => {
      live = false
    }
  }, [velcro])

  useEffect(() => refresh(), [refresh])

  const configure = useCallback(
    async (name, values) => {
      const result = await velcro.configurePlugin(name, values)

      // Read back rather than assuming: the restart is where a wrong port shows up,
      // and the manifest carries the status that says so.
      refresh()

      return result ?? { ok: false }
    },
    [velcro, refresh],
  )

  return { plugins, loading, configure, refresh }
}
