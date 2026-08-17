import { useCallback, useEffect, useRef, useState } from 'react'

import { cx } from '../../toolkits/cx'

// Broadcast graphics do not snap between values; they animate out, swap, and
// animate back in. This is the little state machine that makes that possible
// declaratively.
//
//   active -> exiting -> (content swaps here) -> entering -> active
//
// The swap happening at the *bottom* of that cycle is the whole point. A name
// change must never show the new name inside the old name's outgoing animation.
//
// Two cases have to be told apart, and conflating them was a real bug:
//
//   trigger changed        a new value -- run the full out/swap/in cycle
//   only children changed  same value, different render (a Timer's text ticking
//                          every second) -- update in place, no animation
//
// A `committed` ref tracks which trigger the on-screen content belongs to. Both
// effects below consult it, so their relative order does not matter. An earlier cut
// had the children effect swap content the instant it changed, and whichever effect
// ran first won: every value change rendered the new text and *then* faded it out
// and back in.
//
// Note what the transition effect does NOT depend on: `children`. Content is read
// from a ref at commit time, so a parent re-render mid-exit cannot restart the
// timer and stall the swap.
//
// Duration comes from computed style, so CSS stays the single source of truth for
// timing -- there is no duration prop to keep in sync with a stylesheet.

/**
 * Two frames: one for the browser to paint the entering state, one to start the
 * transition from it. A single frame can be coalesced and skip the fade.
 *
 * Returns a canceller, and that matters. An uncancelled callback firing after the
 * phase has already moved on drags it back to `active` mid-exit and restarts the
 * cycle -- most likely right after mount, when a stored value lands within a frame
 * or two of the fallback being painted.
 */
function nextFrame(fn) {
  let inner = 0
  const outer = requestAnimationFrame(() => {
    inner = requestAnimationFrame(fn)
  })

  return () => {
    cancelAnimationFrame(outer)
    if (inner) cancelAnimationFrame(inner)
  }
}

function durationOf(element) {
  if (!element) return 0

  const style = window.getComputedStyle(element)
  const times = [style.transitionDuration, style.animationDuration]
    .join(',')
    .split(',')
    .map((value) => parseFloat(value) || 0)

  return Math.max(0, ...times) * 1000
}

export function Transition({ children, trigger, className, as: Tag = 'div', ...rest }) {
  const [content, setContent] = useState(children)
  const [phase, setPhase] = useState(trigger ? 'entering' : 'inactive')
  const ref = useRef(null)
  const timer = useRef(null)

  // The trigger the on-screen content belongs to. Only moves when content swaps.
  const committed = useRef(trigger)
  // Always the newest children, read at swap time rather than captured earlier.
  const latest = useRef(children)

  latest.current = children

  const commit = useCallback(() => {
    committed.current = trigger
    setContent(latest.current)
    setPhase(trigger ? 'entering' : 'inactive')
  }, [trigger])

  // Same value, different render: let content through untouched. A running clock
  // must not animate once a second.
  useEffect(() => {
    if (!Object.is(committed.current, trigger)) return
    if (phase === 'active' || phase === 'inactive') setContent(latest.current)
  }, [children, phase, trigger])

  // A new value: out, swap, in.
  useEffect(() => {
    if (Object.is(committed.current, trigger)) return undefined

    // Nothing on screen to animate out -- go straight in.
    if (phase === 'inactive') {
      commit()
      return undefined
    }

    if (phase !== 'exiting') {
      setPhase('exiting')
      return undefined
    }

    timer.current = setTimeout(commit, durationOf(ref.current))

    return () => clearTimeout(timer.current)
  }, [trigger, phase, commit])

  useEffect(() => {
    if (phase !== 'entering') return undefined

    return nextFrame(() => setPhase('active'))
  }, [phase])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <Tag ref={ref} data-state={phase} className={cx('ss-transition', `ss-${phase}`, className)} {...rest}>
      {content}
    </Tag>
  )
}
