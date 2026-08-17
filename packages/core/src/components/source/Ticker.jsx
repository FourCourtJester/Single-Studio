import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'

/**
 * Scrolling crawl.
 *
 * Duration is derived from measured content width and a pixels-per-second speed
 * so the crawl moves at a constant rate regardless of how much text there is --
 * a fixed duration would make a short message crawl and a long one sprint.
 * New text is staged and only swapped in between passes, never mid-scroll.
 */
export function Ticker({ name, fallback = '', speed = 100, className, namespace = 'variables', ...rest }) {
  const incoming = useVelcroValue(`${namespace}.${name}`, fallback)
  const [text, setText] = useState('')
  const [duration, setDuration] = useState(0)
  const staged = useRef('')
  const track = useRef(null)
  const viewport = useRef(null)

  staged.current = String(incoming ?? '').trim()

  // Adopt new text immediately when nothing is showing, otherwise wait for the
  // current pass to finish.
  useEffect(() => {
    if (!text) setText(staged.current)
  }, [text, incoming])

  useLayoutEffect(() => {
    if (!track.current || !viewport.current) return

    const distance = viewport.current.offsetWidth + track.current.scrollWidth

    setDuration(speed > 0 ? distance / speed : 0)
  }, [text, speed])

  const onIteration = () => setText(staged.current)

  return (
    <div ref={viewport} className={cx('ss-ticker flex h-full w-full items-center overflow-hidden whitespace-nowrap', className)} {...rest}>
      {text ? (
        <div
          ref={track}
          className="ss-ticker-track inline-block"
          style={{
            animationName: 'ss-ticker-scroll',
            animationDuration: `${duration}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
          }}
          onAnimationIteration={onIteration}
        >
          {text}
        </div>
      ) : null}
    </div>
  )
}
