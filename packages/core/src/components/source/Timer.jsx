import { useEffect, useRef } from 'react'

import { useTimer } from '../../hooks/useTimer'
import { cx } from '../../toolkits/cx'
import { Transition } from '../common/Transition'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'timers'

/**
 * @typedef {object} TimerProps
 * @property {string} name - Names a value under `timers` — e.g. `round`.
 * @property {string} [fallback] - Shown when no clock is set. Defaults to `"00:00"`.
 * @property {() => void} [onComplete] - Called once, when a countdown reaches zero.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * A clock on air, reading whichever kind was stored — a countdown, a count-up, or
 * a paused one. Shows 00:00 for a second when a countdown ends, then takes itself
 * off air.
 *
 * The trigger is `active`, not the text -- the display ticks once a second and
 * animating each tick would be unreadable. Only starting and finishing animate.
 *
 * **It shows the zero, then takes itself away.** A countdown used to vanish at the
 * instant it reached zero, so the number the whole thing exists to reach was the one
 * frame nobody ever saw -- 00:01, then the graphic animating out. The zero now gets
 * the same second on screen as every other digit, and then the graphic leaves on its
 * own, because a timer somebody has to remember to dismiss during a show is a timer
 * that stays on air.
 *
 * Nothing here does that. `active` does -- see `useTimer`. It is arithmetic on the
 * stored instant, so the zero appears and leaves at the same moment on every machine
 * with nobody telling anybody.
 *
 * `onComplete` fires on `running`, so it lands when the clock actually runs out
 * rather than a second later when the graphic goes.
 *
 * (The first frame was already right, and is worth stating because the two look like
 * one problem. A countdown rounds *up*, so each digit holds for a full second and a
 * five-second timer opens on 00:05. See `formatDuration`.)
 *
 * @example
 * <Timer name="round" fallback="--:--" />
 *
 * @example
 * // Do something when the clock runs out
 * <Timer name="break" onComplete={() => setScene("live")} />
 *
 * @param {TimerProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Timer({ name, fallback = '00:00', onComplete, className, ...rest }) {
  const { active, running, text, loaded } = useTimer(`${NAMESPACE}.${name}`)
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
