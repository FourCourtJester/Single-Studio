import { useEffect, useMemo, useState } from 'react'

import { displayedSeconds, formatDuration } from '../toolkits/time'
import { useClockOffset } from './useSync'
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
 * How long a finished countdown stays on screen showing 00:00.
 *
 * One second, and it is not a taste decision -- it is the dwell every other digit
 * already has. A countdown rounds up, so 00:05 is on screen for a second, and 00:01
 * is on screen for a second, and the zero being the exception is the whole
 * complaint: the number the clock exists to reach was the one nobody ever saw.
 *
 * Then it goes, on its own. A graphic that waits to be dismissed is a graphic
 * somebody has to remember during a show, and remembering it is worth nothing --
 * the countdown is over, everyone can see that it is over, and the operator has
 * moved on to whatever the countdown was counting towards.
 *
 * Derived, never written. Every peer computes this from the same stored instant, so
 * the zero appears and leaves at the same moment on every machine with nobody
 * telling anybody -- and a countdown left in the document from last week is simply
 * long past, rather than a graphic that has to be cleaned up before it goes to air.
 */
const REST = 1000

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
 *
 * Machine skew is the one thing a stored instant cannot absorb on its own, since
 * two machines disagreeing about what "now" is will read the same timestamp as two
 * different numbers. `useClockOffset` is that difference, and it is nought unless
 * somebody in the room has been named the clock -- see docs/internal/collaboration.md.
 *
 * The sampling below is a view concern only. Nothing about it is written anywhere,
 * so a slow or throttled tab renders late but never wrong: the next sample derives
 * the correct value from the stored instant regardless of how many it missed.
 */
export function useTimer(path) {
  const { value: timer, loaded } = useVelcroState(path)
  const offset = useClockOffset()
  const [tick, force] = useState(0)

  const target = timer?.ts
  const from = timer?.from

  useEffect(() => {
    if (!target && !from) return undefined

    const shown = () => displayedSeconds({ ts: target, from }, Date.now() + offset)

    let last = shown()
    let id = null
    let tail = null

    /**
     * One last render, when the zero has had its second.
     *
     * The sampler cannot do it: `shown()` has been 0 since the clock ran out and
     * stays 0, so there is no change for it to notice, and the thing that has to
     * change is the *rest* elapsing rather than the number moving.
     */
    const rest = () => {
      const left = target + REST - (Date.now() + offset)

      if (left > 0) tail = setTimeout(() => force((n) => n + 1), left)
    }

    // Mounted onto a countdown that has already run out. Nothing to sample; it
    // either has some of its second left or it is long gone.
    if (target && last <= 0) rest()
    else {
      const sample = () => {
        const next = shown()

        if (next === last) return

        last = next
        force((n) => n + 1)

        // Reached zero: stop sampling a number that cannot move again, and wait out
        // the second it is owed.
        if (target && next <= 0) {
          clearInterval(id)
          rest()
        }
      }

      id = setInterval(sample, SAMPLE)
    }

    return () => {
      clearInterval(id)
      clearTimeout(tail)
    }
  }, [target, from, offset])

  return useMemo(() => {
    const now = Date.now() + offset
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
      /**
       * On screen: counting down, or showing the zero it reached a moment ago.
       *
       * This used to be `remaining > 0` -- an alias for `running` -- which is why a
       * countdown vanished at the instant it reached zero and never showed it. It
       * is not `Boolean(target)` either: that rests on 00:00 until somebody clears
       * it, and nobody is going to sit on a finished timer to take it off air.
       *
       * So: a second past the target, and then gone. Note what it is *not* -- a
       * written state, a flag, or anything a machine has to tell another machine.
       * It is arithmetic on the same stored instant every peer already has, which
       * is the property the whole clock design rests on.
       *
       * `remaining >= 0` was the tempting one-character version and is wrong for a
       * different reason: `remaining` is 0 both for a countdown that finished and
       * for a path holding no countdown at all, so it reads as "always".
       */
      active: Boolean(target) && now - target < REST,
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
  }, [loaded, offset, target, from, timer?.elapsed, timer?.duration, timer?.input, tick])
}
