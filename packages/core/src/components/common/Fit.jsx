import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { cx } from '../../toolkits/cx'

// Binary-search the largest font size that keeps content on one line.
//
// A span, and inline-block in the stylesheet. Both halves are load-bearing: a span
// so this can sit inside one -- a `div` in a `<span>` in a `<p>` is invalid markup
// the browser silently restructures -- and inline-block because an *inline* element
// reports `scrollWidth` as 0, which is the one measurement the search depends on.
// Measured: inline 0, inline-block 219, block 219, for the same overflowing text.
//
// This is the long-player-name problem: a lower-third sized for "Kim" has to
// also hold "Vandersteen-Rodriguez" without wrapping or overflowing. Twenty-five
// halvings converge well past sub-pixel, and it re-runs on content or container
// change rather than on a timer.

const ITERATIONS = 25

export function Fit({ children, className, delta = 1, max, as: Tag = 'span', ...rest }) {
  const ref = useRef(null)
  const [pending, setPending] = useState(true)

  const measure = useCallback(() => {
    const element = ref.current
    const parent = element?.parentElement

    if (!element || !parent) return

    const parentStyle = window.getComputedStyle(parent)
    const ceiling = max ?? parseFloat(parentStyle.fontSize)
    const available = () => parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight)

    element.style.fontSize = ''

    if (element.scrollWidth <= available()) return

    let low = 0
    let high = ceiling

    for (let i = 0; i < ITERATIONS; i += 1) {
      const mid = (low + high) / 2

      element.style.fontSize = `${mid}px`

      const width = element.scrollWidth
      const room = available()

      if (width <= room && width > room - delta) break
      if (width > room) high = mid
      else low = mid
    }
  }, [delta, max])

  useLayoutEffect(() => {
    if (!pending) return
    measure()
    setPending(false)
  }, [measure, pending])

  useEffect(() => {
    const parent = ref.current?.parentElement

    if (!parent) return undefined

    const invalidate = () => setPending(true)
    const resize = new ResizeObserver(invalidate)
    const mutate = new MutationObserver(invalidate)

    resize.observe(parent)
    mutate.observe(parent, { characterData: true, childList: true, subtree: true })

    return () => {
      resize.disconnect()
      mutate.disconnect()
    }
  }, [])

  return (
    <Tag ref={ref} className={cx('ss-fit whitespace-nowrap', className)} {...rest}>
      {children}
    </Tag>
  )
}
