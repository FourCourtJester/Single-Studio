import { useEffect, useMemo, useState } from 'react'

import { displayedSeconds, formatDuration } from '../toolkits/time'
import { useVelcroState } from './useVelcroValue'

/**
 * How often the view checks a clock, in milliseconds.
 *
 * Not the tick rate -- the *sampling* rate. An earlier cut chased the next whole
 * second with a single setTimeout, which is only as accurate as setTimeout is, and
 * setTimeout is late: under load a tick could stretch well past a second, which
 * reads on screen as a clock stumbling. Worse, the delay was computed as
 * `elapsed % 1000` for a count-up, which is the time *since* the last boundary
 * rather than until the next one, so a stopwatch scheduled itself at genuinely
 * arbitrary offsets and wandered visibly.
 *
 * Sampling four times a second and rendering only when the displayed second
 * actually changes removes the arithmetic entirely, and bounds how late a tick can
 * be at 250ms instead of an unbounded overshoot. The comparison is one subtraction,
 * so the three extra samples cost nothing and never reach React.
 */
const SAMPLE = 250

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
 *
 * The sampling below is a view concern only. Nothing about it is written anywhere,
 * so a slow or throttled tab renders late but never wrong: the next sample derives
 * the correct value from the stored instant regardless of how many it missed.
 */
export function useTimer(path) {
  const { value: timer, loaded } = useVelcroState(path)
  const [tick, force] = useState(0)

  const target = timer?.ts
  const from = timer?.from

  useEffect(() => {
    if (!target && !from) return undefined

    const shown = () => displayedSeconds({ ts: target, from })

    let last = shown()
    let id = null

    const sample = () => {
      const next = shown()

      if (next === last) return

      last = next
      force((n) => n + 1)

      // A countdown that has reached zero has nothing left to say.
      if (target && next <= 0) clearInterval(id)
    }

    id = setInterval(sample, SAMPLE)

    return () => clearInterval(id)
  }, [target, from])

  return useMemo(() => {
    const now = Date.now()
    const up = { round: 'floor' }

    if (from) {
      const elapsed = Math.max(0, now - from)

      return { loaded, mode: 'up', running: true, active: true, elapsed, remaining: 0, duration: 0, text: formatDuration(elapsed, up) }
    }

    if (timer?.elapsed !== undefined) {
      const elapsed = Math.max(0, Number(timer.elapsed))

      return { loaded, mode: 'up', running: false, active: true, elapsed, remaining: 0, duration: 0, text: formatDuration(elapsed, up) }
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
    // `tick` is what advances `now`. It carries no information itself, which is why
    // the rule cannot see the point of it; it is in the dependency list precisely so
    // that a sample which changed the displayed second recomputes this, and a sample
    // which did not, does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, target, from, timer?.elapsed, timer?.duration, timer?.input, tick])
}
