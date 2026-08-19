import { useEffect, useRef } from 'react'

import { useTimer } from '../../hooks/useTimer'
import { cx } from '../../toolkits/cx'
import { Transition } from '../common/Transition'

/**
 * A countdown. Derives from an absolute target time, so it needs no sync.
 *
 * The trigger is `active`, not the text -- the display ticks once a second and
 * animating each tick would be unreadable. Only starting and finishing animate.
 *
 * **It rests on 00:00.** A countdown used to vanish the instant it ran out, so the
 * zero it was counting towards was the one frame nobody ever saw -- 00:01, then the
 * graphic animating away. That is a fair reading of "the countdown is over" and it
 * is the wrong one for anybody watching: a five-second countdown that never shows a
 * zero has not counted anything, and it is the note every client sends back.
 *
 * Nothing here changed to get that. `active` did: it meant "has time left" and now
 * means "there is a countdown", which is what it already meant for a stopwatch. So
 * the graphic stays until somebody clears the clock -- a break timer on 00:00 is a
 * graphic saying "we are back" -- and `TimerButton` offers **Clear** to do it.
 *
 * `onComplete` fires on `running`, not on `active`, or it would announce the
 * countdown finishing at the moment somebody cleared it instead.
 *
 * (The first frame was already right, and is worth stating because the two look
 * like one problem. A countdown rounds *up*, so each digit holds for a full second
 * and a five-second timer opens on 00:05. See `formatDuration`.)
 */
export function Timer({ name, fallback = '00:00', onComplete, className, namespace = 'timers', ...rest }) {
  const { active, running, text, loaded } = useTimer(`${namespace}.${name}`)
  const was = useRef(running)

  useEffect(() => {
    if (was.current && !running) onComplete?.()
    was.current = running
  }, [running, onComplete])

  return (
    <Transition trigger={loaded && active} className={cx('ss-timer tabular-nums', className)} {...rest}>
      {loaded ? (active ? text : fallback) : null}
    </Transition>
  )
}
