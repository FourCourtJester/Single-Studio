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

/** How far up to look for the box before giving up and using the parent. */
const DEPTH = 12

/**
 * The nearest ancestor whose width does not depend on this text.
 *
 * The measurement has to happen against the box the author was thinking of, and
 * that is very often not `parentElement`. `Variable` renders this inside its own
 * span; a `<Fit>` written by hand usually sits in one too. A span is sized by its
 * content, so measuring it asks "does the text fit inside itself", the answer is
 * always yes, and `fit` did nothing at all -- silently, with no warning and no
 * partial effect. Every use of it in the first real show was inert.
 *
 * Found by measuring rather than by guessing at `display`, because the question is
 * not what kind of box an ancestor is. Floats, flex items, `inline-block`, tables
 * and absolutely positioned elements are all sized by their contents in some
 * configurations and not others, and a rule made of display values would be a list
 * of exceptions that is wrong for the next layout somebody writes.
 *
 * So: shrink the text right down, note every ancestor's width, grow it, note them
 * again. Any ancestor whose width moved is one this text is deciding the size of,
 * and is no use as a limit. The first one that did not move is the box.
 *
 * Two layouts, on a path that already forces one, and only when the content or the
 * container changed.
 */
function boxFor(element) {
  const was = element.style.fontSize
  const ancestors = []

  for (let node = element.parentElement, i = 0; node && i < DEPTH; node = node.parentElement, i += 1) {
    ancestors.push(node)
  }

  if (!ancestors.length) return null

  element.style.fontSize = '1px'
  const narrow = ancestors.map((node) => node.clientWidth)

  element.style.fontSize = ''
  const natural = ancestors.map((node) => node.clientWidth)

  element.style.fontSize = was

  // The last resort is the outermost one looked at rather than nothing: a chain
  // that is shrink-to-fit the whole way up is a layout with no limit in it, and the
  // outermost is the closest thing to an answer.
  return ancestors.find((_node, at) => narrow[at] === natural[at]) ?? ancestors.at(-1)
}

export function Fit({ children, className, delta = 1, max, as: Tag = 'span', ...rest }) {
  const ref = useRef(null)
  const [pending, setPending] = useState(true)

  const measure = useCallback(() => {
    const element = ref.current
    const parent = element?.parentElement

    if (!element || !parent) return

    element.style.fontSize = ''

    const box = boxFor(element)

    if (!box) return

    const boxStyle = window.getComputedStyle(box)
    // The ceiling is the size this text would be if nothing shrank it, which is
    // inherited -- so it comes from the immediate parent whatever the box turned
    // out to be.
    const ceiling = max ?? parseFloat(window.getComputedStyle(parent).fontSize)
    const available = () => box.clientWidth - parseFloat(boxStyle.paddingLeft) - parseFloat(boxStyle.paddingRight)

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
    const element = ref.current
    const parent = element?.parentElement

    if (!parent) return undefined

    const invalidate = () => setPending(true)
    const resize = new ResizeObserver(invalidate)
    const mutate = new MutationObserver(invalidate)

    // The box is what changes the answer when the layout moves, and the parent is
    // what changes it when the words do. Usually the same element; when they are
    // not, watching only the parent misses a window resize entirely.
    resize.observe(boxFor(element) ?? parent)
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
