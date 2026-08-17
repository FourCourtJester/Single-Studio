import { useEffect, useState } from 'react'

import { cx } from '../../toolkits/cx'

const now = (locale, options) => new Date().toLocaleTimeString(locale, options)

/** Wall clock. Local to each machine by definition, so it never replicates. */
export function Clock({ locale, options, className, ...rest }) {
  const [time, setTime] = useState(() => now(locale, options))

  useEffect(() => {
    const tick = () => setTime(now(locale, options))
    const timer = setInterval(tick, 1000)

    tick()

    return () => clearInterval(timer)
  }, [locale, options])

  return (
    <div className={cx('ss-clock tabular-nums', className)} {...rest}>
      {time}
    </div>
  )
}
