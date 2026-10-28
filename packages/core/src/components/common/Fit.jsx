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

  // A width of 0 at both sizes is not a box that held still, it is no box at all:
  // an inline element's clientWidth is 0 by definition. Variable's own span is
  // inline wherever its parent is a plain block, so without this the search stopped
  // there, read 0px of room, and halved a 30px name nine times to 0.0586px. A flex
  // parent blockifies the span, which is why the scoreboard never showed it.
  //
  // The last resort is the outermost one looked at rather than nothing: a chain
  // that is shrink-to-fit the whole way up is a layout with no limit in it, and the
  // outermost is the closest thing to an answer.
  return ancestors.find((_node, at) => natural[at] > 0 && narrow[at] === natural[at]) ?? ancestors.at(-1)
}

/**
 * How many lines the text takes, counted from its line boxes rather than from
 * `line-height`: a Range over the text gives one rect per line fragment, and rects
 * starting more than half a line below the last one start a new line. `line-height:
 * normal` computes to the word "normal", and a bold or larger span inside a line
 * sits a few pixels off its neighbours' tops -- both of which a division by
 * line-height gets wrong.
 */
function linesOf(element) {
  const range = document.createRange()
  range.selectNodeContents(element)

  const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0).sort((a, b) => a.top - b.top)
  let lines = 0
  let floor = -Infinity

  for (const rect of rects) {
    if (rect.top >= floor) {
      lines += 1
      floor = rect.top + rect.height / 2
    }
  }

  return Math.max(lines, 1)
}

/**
 * Every prop optional, as it is at runtime. Undescribed, TypeScript read each
 * destructured name as a required prop, so a studio checked with it could not write
 * `<Fit>{name}</Fit>` -- the first one to try was the demo's Twitch alerts.
 *
 * @typedef {object} FitProps
 * @property {import("react").ReactNode} [children]
 * @property {string} [className] - Added to the component's own classes.
 * @property {number} [delta] - How close to the box's width is close enough, in pixels. Defaults to 1.
 * @property {number} [max] - The largest font size, in pixels. Defaults to the size the text inherits.
 * @property {number} [lines] - The most lines the text may wrap onto. Defaults to `1`, which keeps it on one line.
 * @property {string} [as] - The element to render. Defaults to `"span"`.
 */

/**
 * Text shrunk to fit its box: the largest size, up to the one it inherits, at which
 * it fits.
 *
 * On one line by default. `lines={2}` lets it wrap onto two and shrinks it only as
 * far as two lines and the box's width need -- a team name that is a long word and
 * a short one stays large across two lines rather than going small on one. No word
 * is broken: a single word wider than the box shrinks the text until it fits. The
 * box's height is not consulted; a box sized for N lines at the text's own size
 * holds N lines at any smaller one.
 *
 * @example
 * <div className="w-[360px] text-5xl">
 *   <Fit lines={2}>{team}</Fit>
 * </div>
 *
 * @param {FitProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Fit({ children, className, delta = 1, max, lines = 1, as: Tag = 'span', ...rest }) {
  const many = lines > 1
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

    // No room at all means no layout yet -- an ancestor not displayed, a box not
    // sized -- not a box the text has to vanish into. Leave it at its natural size;
    // the observers measure again once there is something to measure against.
    if (available() <= 0) return

    if (many) {
      // Wrapping makes "fits" two questions, the width and the count, and leaves no
      // single measurement to stop early on -- so this searches on size alone and
      // ends on the largest that fitted, never on the last one tried. That last one
      // can be a size that did not fit, and on one line the slack is a sub-pixel of
      // width; on several it is a whole extra line.
      const fits = () => element.scrollWidth <= available() && linesOf(element) <= lines

      if (fits()) return

      let low = 0
      let high = ceiling

      for (let i = 0; i < ITERATIONS && high - low > 0.01; i += 1) {
        const mid = (low + high) / 2

        element.style.fontSize = `${mid}px`

        if (fits()) low = mid
        else high = mid
      }

      element.style.fontSize = `${low}px`
      return
    }

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
  }, [delta, max, lines, many])

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
    <Tag ref={ref} className={cx('ss-fit', many ? 'whitespace-normal' : 'whitespace-nowrap', className)} {...rest}>
      {children}
    </Tag>
  )
}
