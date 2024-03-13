// Import core components
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Import our components
import { useVelcroValue } from 'hooks'
import { timeToString } from 'toolkits/time'

export const useTimer = ({ path, value }) => {
  // Hooks
  const timer = useVelcroValue(path)
  // States
  const [time, setTime] = useState(0)
  // Variables
  const cache = timer?._ts
  const input = timer?._input
  // Refs
  const t = useRef()

  const calc = useCallback(() => {
    const _cache = cache || value
    const diff = Math.ceil(_cache - Date.now())

    setTime(diff > 0 ? diff : -1)
  }, [cache, value])

  useEffect(() => {
    calc()

    const _cache = cache || value
    if (!_cache) clearTimeout(t.current)
  }, [calc, cache, value])

  return useMemo(() => {
    const obj = {
      active: time > 0,
      input,
      text: timeToString(time),
    }

    clearTimeout(t.current)

    if (time > 0) {
      t.current = setTimeout(() => calc(), 1000)
    }

    return obj
  }, [calc, input, time])
}
