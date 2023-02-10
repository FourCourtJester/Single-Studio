// Import core components
import { useEffect, useMemo, useRef, useState } from 'react'

// Import our components
import { useStudio } from 'hooks'

/**
 * Converts a number representing elapsed time to a string
 *
 * @param {number} t
 * @returns {string}
 */
function timeToString(t) {
  if (!t || t <= 0) return '00:00'

  const d = new Date(t).toISOString()
  return t >= 3600000 ? d.slice(11, -5) : d.slice(14, -5)
}

export const useTimer = ({ path }) => {
  // Redux
  const val = useStudio(path)
  // States
  const [time, setTime] = useState(0)
  // Refs
  const t = useRef(null)

  useEffect(() => {
    setTime(val > 0 ? Math.ceil(val - Date.now()) : -1)
    if (!val) clearTimeout(t.current)
  }, [val])

  return useMemo(() => {
    const obj = {
      active: time >= 0,
      text: timeToString(time),
    }

    clearTimeout(t.current)

    if (time >= 0) {
      t.current = setTimeout(() => setTime(time - 1000), 1000)
    }

    return obj
  }, [time])
}
