import { useEffect, useRef } from 'react'

import { useTimer } from '../../hooks/useTimer'
import { cx } from '../../toolkits/cx'
import { parseDuration } from '../../toolkits/time'
import { Transition } from '../common/Transition'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'timers'

/**
 * @typedef {object} TimerProps
 * @property {string} name - Names a value under `timers` — e.g. `round`.
 * @property {string} [fallback] - Shown when no clock is set. Defaults to `"00:00"`.
 * @property {string|number} [limit] - How long a count-up may run — `"2:00"`, or seconds. Past it, the element gets `data-over` and `ss-over`.
 * @property {() => void} [onComplete] - Called once, when a countdown reaches zero.
 * @property {string} [as] - The element to render. Defaults to `"span"`.
 * @property {string} [transition] - Motion variants, space-separated — e.g. `"slide-up ease-back"`. See [the transitions guide](getting-started.md#transitions).
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * A clock on air, reading whichever kind was stored — a countdown, a count-up, or
 * a paused one. A finished countdown takes itself off air; nobody has to remember
 * to clear it mid-show.
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
 * **`limit` marks a count-up that has overrun**, for the segment that is only
 * allowed two minutes. Past it the element carries `data-over` and the class
 * `ss-over`, and what that looks like is the studio's to say -- turn it red, flash
 * it, put a rule under it. There is no matching control on the dashboard on
 * purpose: the allowance is a property of the show, decided when the graphic is
 * written, not something an operator should be setting under time pressure.
 *
 * Count-ups only, because a countdown already carries its own end. Nothing about a
 * countdown is "over" -- it finishes, shows its zero, and leaves.
 *
 * @example
 * <Timer name="round" fallback="--:--" />
 *
 * @example
 * // Red once the segment has run past two minutes
 * <Timer name="segment" limit="2:00" className="text-white [&[data-over]]:text-red-500" />
 *
 * @example
 * // Do something when the clock runs out
 * <Timer name="break" onComplete={() => setScene("live")} />
 *
 * @param {TimerProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Timer({ name, fallback = '00:00', limit, onComplete, as = 'span', className, ...rest }) {
  const { active, running, text, loaded, mode, elapsed } = useTimer(`${NAMESPACE}.${name}`)
  const was = useRef(running)

  useEffect(() => {
    if (was.current && !running) onComplete?.()
    was.current = running
  }, [running, onComplete])

  // `limit` is read every render rather than latched, so a clock that is reset back
  // under its allowance stops being marked -- the same way it stops being red.
  const allowed = limit === undefined ? 0 : parseDuration(limit)
  const over = allowed > 0 && mode === 'up' && elapsed >= allowed

  return (
    <Transition
      trigger={loaded && active}
      as={as}
      data-over={over ? '' : undefined}
      className={cx('ss-timer tabular-nums', over && 'ss-over', className)}
      {...rest}
    >
      {loaded ? (active ? text : fallback) : null}
    </Transition>
  )
}
