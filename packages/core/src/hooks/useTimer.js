import { useEffect, useMemo, useRef, useState } from 'react'

import { formatDuration } from '../toolkits/time'
import { useVelcroValue } from './useVelcroValue'

/**
 * Read a countdown stored as an absolute epoch (`{ ts, duration }`).
 *
 * Storing the target time rather than a remaining count is what makes timers
 * replicate for free: every peer derives the same countdown from the same
 * timestamp and nobody has to synchronise a tick. (Clock skew between machines
 * is the one caveat -- see docs/collaboration.md.)
 */
export function useTimer(path) {
  const timer = useVelcroValue(path)
  const target = timer?.ts
  const [remaining, setRemaining] = useState(0)
  const frame = useRef(null)

  useEffect(() => {
    if (!target) {
      setRemaining(0)
      return undefined
    }

    const tick = () => {
      const left = target - Date.now()

      setRemaining(left > 0 ? left : 0)

      // Re-align to the next whole second so the display never skips a number.
      if (left > 0) frame.current = setTimeout(tick, left % 1000 || 1000)
    }

    tick()

    return () => clearTimeout(frame.current)
  }, [target])

  return useMemo(
    () => ({
      active: remaining > 0,
      remaining,
      duration: timer?.duration ?? 0,
      text: formatDuration(remaining),
    }),
    [remaining, timer?.duration],
  )
}
