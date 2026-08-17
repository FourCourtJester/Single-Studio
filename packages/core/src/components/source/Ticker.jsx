import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'

/**
 * Scrolling crawl.
 *
 * The travel is measured, not expressed in percentages. A percentage transform
 * resolves against the *element's own* width, so `translateX(100%)` on the text
 * only moves it one text-width right of where it already sits -- which for a short
 * message is still inside the viewport, and the crawl appears to start partway
 * across rather than off the edge. It also made the speed wrong: the distance
 * actually travelled was twice the text width, while the duration was calculated
 * for viewport-plus-text.
 *
 * So the start and end offsets are measured in pixels and handed to the keyframes
 * as custom properties: start one viewport-width to the right, end one text-width
 * to the left. Distance and duration then agree, and `speed` means what it says --
 * pixels per second, constant regardless of how much text there is.
 *
 * New text is staged and swapped between passes, never mid-scroll.
 */
export function Ticker({ name, fallback = '', speed = 100, className, namespace = 'variables', ...rest }) {
  const { value, loaded } = useVelcroState(`${namespace}.${name}`)
  const incoming = loaded ? (value ?? fallback) : ''
  const [text, setText] = useState('')
  const [metrics, setMetrics] = useState({ from: 0, to: 0, duration: 0 })
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
    const element = viewport.current

    if (!element) return undefined

    const measure = () => {
      if (!track.current || !viewport.current) return

      const across = viewport.current.clientWidth
      const content = track.current.scrollWidth

      setMetrics({
        from: across,
        to: -content,
        duration: speed > 0 ? (across + content) / speed : 0,
      })
    }

    measure()

    // Re-measure when the source is resized -- an OBS dock or a rescaled browser
    // source changes the distance the crawl has to cover.
    const observer = new ResizeObserver(measure)

    observer.observe(element)

    return () => observer.disconnect()
  }, [text, speed])

  const onIteration = () => setText(staged.current)

  // A zero duration would fire iteration events in a tight loop, so the animation
  // is withheld until there is something real to measure against.
  const running = Boolean(text) && metrics.duration > 0

  return (
    <div ref={viewport} className={cx('ss-ticker flex h-full w-full items-center overflow-hidden whitespace-nowrap', className)} {...rest}>
      {text ? (
        <div
          ref={track}
          className="ss-ticker-track inline-block"
          style={{
            '--ss-ticker-from': `${metrics.from}px`,
            '--ss-ticker-to': `${metrics.to}px`,
            animationName: running ? 'ss-ticker-scroll' : undefined,
            animationDuration: running ? `${metrics.duration}s` : undefined,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            // Parked off the right edge until it can be measured, so a crawl never
            // flashes into view at its natural position before the first frame.
            transform: running ? undefined : 'translateX(100vw)',
          }}
          onAnimationIteration={onIteration}
        >
          {text}
        </div>
      ) : null}
    </div>
  )
}
