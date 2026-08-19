import { useEffect, useRef, useState } from 'react'

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
 * five and never shows a zero has not counted anything, and it is the note every
 * client sends back. The numbers were always right; what was missing was the last
 * one staying on screen.
 *
 * (The first frame was already right, and is worth stating because the two look
 * like one problem. A countdown rounds *up*, so each digit holds for a full second
 * and a five-second timer opens on 00:05. See `formatDuration`.)
 *
 * `hold` is how long it rests there, in milliseconds, and defaults to forever: a
 * break timer sitting on 00:00 is a graphic saying "we are back", and a graphic
 * that removes itself at the moment somebody is looking at it is the failure this
 * exists to fix. `hold={3000}` gives a three-second rest and then the old exit;
 * `hold={0}` is the old behaviour exactly.
 */
export function Timer({ name, fallback = '00:00', hold = Infinity, onComplete, className, namespace = 'timers', ...rest }) {
  const { active, finished, text, loaded } = useTimer(`${namespace}.${name}`)
  const was = useRef(active)

  /**
   * Whether this timer ran down where we could see it.
   *
   * Without it, a stale countdown left in the document from last week would put
   * 00:00 on air at startup -- the state on load is identical to the state one
   * frame after finishing, and only the history tells them apart. A zero is the
   * *end of a count*, so it is owed to a count somebody watched, not to a timestamp
   * that happens to be in the past.
   */
  const ran = useRef(false)
  const [rested, setRested] = useState(false)

  useEffect(() => {
    if (active) ran.current = true
  }, [active])

  useEffect(() => {
    if (was.current && !active) onComplete?.()
    was.current = active
  }, [active, onComplete])

  useEffect(() => {
    if (!finished || !ran.current) {
      setRested(false)
      return undefined
    }

    if (hold <= 0) {
      setRested(true)
      return undefined
    }

    if (!Number.isFinite(hold)) return undefined

    const id = setTimeout(() => setRested(true), hold)

    return () => clearTimeout(id)
  }, [finished, hold])

  const showing = active || (finished && ran.current && !rested)

  return (
    <Transition trigger={loaded && showing} className={cx('ss-timer tabular-nums', className)} {...rest}>
      {loaded ? (showing ? text : fallback) : null}
    </Transition>
  )
}
