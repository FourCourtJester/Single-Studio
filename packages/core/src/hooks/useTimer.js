import { useEffect, useMemo, useRef, useState } from 'react'

import { formatDuration } from '../toolkits/time'
import { useVelcroState } from './useVelcroValue'

/**
 * Read a clock. Three shapes, one hook.
 *
 *   { ts, duration }  counting down to a target epoch  -- a break, a countdown
 *   { from }          counting up since an epoch       -- match elapsed, running
 *   { elapsed }       counting up, paused at that much
 *
 * Every one of them stores an *instant*, never a running count. That is what makes
 * clocks replicate for free: each peer derives the same number from the same
 * timestamp, so there is nothing to synchronise and no drift to correct. It is also
 * why a paused stopwatch stores what it held rather than stopping a tick somewhere.
 * (Clock skew between machines is the one caveat -- see docs/collaboration.md.)
 */
export function useTimer(path) {
  const { value: timer, loaded } = useVelcroState(path)
  const [, force] = useState(0)
  const frame = useRef(null)

  const target = timer?.ts
  const from = timer?.from
  const held = timer?.elapsed

  useEffect(() => {
    clearTimeout(frame.current)

    if (!target && !from) return undefined

    const tick = () => {
      force((n) => n + 1)

      const left = target ? target - Date.now() : null

      if (target && left <= 0) return

      // Re-align to the next whole second so the display never skips a number.
      const drift = target ? left % 1000 : (Date.now() - from) % 1000

      frame.current = setTimeout(tick, drift || 1000)
    }

    tick()

    return () => clearTimeout(frame.current)
  }, [target, from])

  return useMemo(() => {
    const now = Date.now()

    if (from) {
      const elapsed = Math.max(0, now - from)

      return { loaded, mode: 'up', running: true, active: true, elapsed, remaining: 0, duration: 0, text: formatDuration(elapsed) }
    }

    if (held !== undefined) {
      const elapsed = Math.max(0, Number(held))

      return { loaded, mode: 'up', running: false, active: true, elapsed, remaining: 0, duration: 0, text: formatDuration(elapsed) }
    }

    const remaining = target ? Math.max(0, target - now) : 0

    return {
      loaded,
      mode: target ? 'down' : 'idle',
      running: remaining > 0,
      active: remaining > 0,
      elapsed: 0,
      remaining,
      duration: timer?.duration ?? 0,
      // The operator's raw entry, when one was stored -- lets a Countdown field
      // repopulate after a reload instead of coming back empty.
      input: timer?.input,
      text: formatDuration(remaining),
    }
    // A re-render from the tick is what advances `now`, so the tick counter has to
    // participate rather than the value being memoised across it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, target, from, held, timer?.duration, timer?.input, frame.current])
}
