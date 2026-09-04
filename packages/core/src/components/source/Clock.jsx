import { useEffect, useState } from 'react'

import { cx } from '../../toolkits/cx'

const now = (locale, options) => new Date().toLocaleTimeString(locale, options)

/**
 * @typedef {object} ClockProps
 * @property {string} [locale] - A [BCP 47 language tag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#locale_identification_and_negotiation), e.g. `en-GB`. Defaults to the browser's.
 * @property {Intl.DateTimeFormatOptions} [options] - Passed straight to [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options).
 * @property {string} [as] - The element to render. Defaults to `"span"`.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * The time of day, from the machine the graphic is running on. Nothing replicates
 * here — every browser source reads its own clock.
 *
 * Formatting is not ours. `locale` and `options` go straight to the platform's
 * [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options), so anything that page documents works here —
 * `hour12`, `timeZone`, `timeZoneName`, `dayPeriod`, `second`, and the rest. There
 * is no wrapper vocabulary to learn and nothing to keep in step with the standard.
 *
 * Note this is the *machine's* clock, uncorrected. It is the right thing for a
 * time-of-day bug in the corner of a scene, and the wrong thing for anything the
 * show is timed against — a countdown or a stopwatch goes through <Timer>, which
 * reads the room's clock so every operator agrees.
 *
 * @example
 * <Clock />
 *
 * @example
 * <Clock locale="en-GB" options={{ hour: '2-digit', minute: '2-digit' }} />
 *
 * @example
 * // Another city's time, named, for a show with a remote guest
 * <Clock options={{ timeZone: 'America/New_York', timeStyle: 'short', timeZoneName: 'short' }} />
 *
 * @param {ClockProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Clock({ locale, options, as = 'span', className, ...rest }) {
  const [time, setTime] = useState(() => now(locale, options))

  useEffect(() => {
    const tick = () => setTime(now(locale, options))
    const timer = setInterval(tick, 1000)

    tick()

    return () => clearInterval(timer)
  }, [locale, options])

  const Tag = as

  return (
    <Tag className={cx('ss-clock tabular-nums', className)} {...rest}>
      {time}
    </Tag>
  )
}
