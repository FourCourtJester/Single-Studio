import { useEffect, useRef, useState } from 'react'

import { cx } from '../../toolkits/cx'

// Broadcast graphics do not snap between values; they animate out, swap, and
// animate back in. This is the little state machine that makes that possible
// declaratively.
//
//   active -> exiting -> (content swaps here) -> entering -> active
//
// The content swap is deferred until the exit finishes, so a name change never
// shows the new name in the old name's outgoing animation. Duration is read off
// the element's computed style, which means CSS stays the single source of truth
// for timing -- no duration prop to keep in sync with a stylesheet.

const nextFrame = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn))

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
  const [shown, setShown] = useState(children)
  const [state, setState] = useState(trigger ? 'entering' : 'inactive')
  const ref = useRef(null)
  const previous = useRef(trigger)
  const timer = useRef(null)

  // Keep content current while nothing is animating, so a re-render with the
  // same trigger is not swallowed.
  useEffect(() => {
    if (state === 'active' || state === 'inactive') setShown(children)
  }, [children, state])

  useEffect(() => {
    if (previous.current === trigger) return undefined

    previous.current = trigger
    clearTimeout(timer.current)

    const commit = () => {
      setShown(children)

      if (!trigger) {
        setState('inactive')
        return
      }

      setState('entering')
      nextFrame(() => setState('active'))
    }

    // Nothing on screen to animate out -- go straight in.
    if (state === 'inactive') {
      commit()
      return undefined
    }

    setState('exiting')
    timer.current = setTimeout(commit, durationOf(ref.current))

    return () => clearTimeout(timer.current)
    // `children` is read at commit time on purpose; re-running on every child
    // render would restart the animation mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  useEffect(() => {
    if (state === 'entering') nextFrame(() => setState('active'))
  }, [state])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <Tag ref={ref} data-state={state} className={cx('ss-transition', `ss-${state}`, className)} {...rest}>
      {shown}
    </Tag>
  )
}
