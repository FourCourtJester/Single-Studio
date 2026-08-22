import { useEffect, useState } from 'react'

import { cx } from '../../toolkits/cx'

const now = (locale, options) => new Date().toLocaleTimeString(locale, options)

/**
 * @typedef {object} ClockProps
 * @property {string} [locale] - BCP 47 tag, e.g. `en-GB`. Defaults to the browser's.
 * @property {Intl.DateTimeFormatOptions} [options] - Passed to `Intl.DateTimeFormat`.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * The time of day, from the machine the graphic is running on. Nothing replicates
 * here — every browser source reads its own clock.
 * @example
 * <Clock />
 *
 * @example
 * <Clock locale="en-GB" options={{ hour: '2-digit', minute: '2-digit' }} />
 *
 * @param {ClockProps & import("react").HTMLAttributes<HTMLElement>} props
 */
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
