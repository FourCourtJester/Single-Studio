// Import core components
import { useEffect, useMemo, useRef, useState } from 'react'

// Import our components
import { useStudio } from 'hooks'
import { timeToString } from 'toolkits/time'

export const useTimer = ({ path }) => {
  // Redux
  const timer = useStudio(path)
  // States
  const [time, setTime] = useState(0)
  // Variables
  const val = timer?._ts
  const input = timer?._input
  // Refs
  const t = useRef(null)

  useEffect(() => {
    const diff = Math.ceil(val - Date.now())

    setTime(diff > 0 ? diff : -1)
    if (!val) clearTimeout(t.current)
  }, [val])

  return useMemo(() => {
    const obj = {
      active: time >= 0,
      input,
      text: timeToString(time),
    }

    clearTimeout(t.current)

    if (time >= 0) {
      t.current = setTimeout(() => setTime(time - 1000), 1000)
    }

    return obj
  }, [input, time])
}
