import { useEffect, useRef } from 'react'

import { useTimer } from '../../hooks/useTimer'
import { cx } from '../../toolkits/cx'
import { Transition } from '../common/Transition'

/**
 * A countdown. Derives from an absolute target time, so it needs no sync.
 *
 * The trigger is `active`, not the text -- the display ticks once a second and
 * animating each tick would be unreadable. Only starting and finishing animate.
 */
export function Timer({ name, fallback = '00:00', onComplete, className, namespace = 'timers', ...rest }) {
  const { active, text, loaded } = useTimer(`${namespace}.${name}`)
  const was = useRef(active)

  useEffect(() => {
    if (was.current && !active) onComplete?.()
    was.current = active
  }, [active, onComplete])

  return (
    <Transition trigger={loaded && active} className={cx('ss-timer tabular-nums', className)} {...rest}>
      {loaded ? (active ? text : fallback) : null}
    </Transition>
  )
}
