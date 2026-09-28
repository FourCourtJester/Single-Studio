// The arithmetic behind `transition="number"`, kept apart from the component so it
// can be tested without a browser.
//
// A count has to *look like the value it is counting to* on every frame, or the last
// frame jumps. So the target's text is read for its shape -- whatever comes before
// and after the number, how many decimals, whether thousands are grouped -- and
// every frame in between is written in that same shape. "$1,000" counts to
// "$1,500" through "$1,237", never through "1237".

/**
 * The number inside a piece of text, and the shape it is written in.
 *
 * Returns null for anything that is not one number with text either side: two
 * numbers ("2 - 1"), none ("Home"), or an empty string. Those are swapped rather
 * than counted.
 *
 * Grouping is recognised only as commas in threes. A studio is free to store a
 * number however it likes, and guessing at other locales' separators from a single
 * value is how "1.500" becomes one and a half.
 *
 * @param {string} text
 * @returns {{ prefix: string, suffix: string, value: number, decimals: number, grouped: boolean } | null}
 */
export function readNumber(text) {
  const match = /^(\D*?)(-?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(\D*)$/.exec(String(text ?? ''))

  if (!match) return null

  const [, prefix, sign, whole, fraction = '', suffix] = match
  const value = Number(`${sign}${whole.replaceAll(',', '')}${fraction ? `.${fraction}` : ''}`)

  if (!Number.isFinite(value)) return null

  return { prefix, suffix, value, decimals: fraction.length, grouped: whole.includes(',') }
}

/**
 * `value`, written the way `shape` was.
 *
 * Deliberately not Intl: the last frame has to be character for character the text
 * the store holds, and a formatter that knows better about locales would make the
 * count end on something the graphic then visibly corrects.
 *
 * @param {number} value
 * @param {{ prefix: string, suffix: string, decimals: number, grouped: boolean }} shape
 */
export function writeNumber(value, { prefix, suffix, decimals, grouped }) {
  const fixed = Math.abs(value).toFixed(decimals)
  const [whole, fraction] = fixed.split('.')
  // A value that rounds to nothing is written without its sign: "-0" on air reads
  // as a fault.
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : ''
  const digits = grouped ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole

  return `${prefix}${sign}${digits}${fraction ? `.${fraction}` : ''}${suffix}`
}

/**
 * Whether two readings can be counted between: the same words either side.
 *
 * "12 pts" to "40 pts" counts. "1st" to "2nd" does not -- the suffix changes, and
 * there is no frame in between that would be spelled correctly.
 */
export function countable(from, to) {
  return Boolean(from && to && from.prefix === to.prefix && from.suffix === to.suffix)
}

/** A CSS time -- `1.2s`, `800ms` -- in milliseconds. Anything else is none. */
export function durationOf(text) {
  const match = /^\s*(-?[\d.]+)(ms|s)\s*$/.exec(String(text ?? ''))

  if (!match) return 0

  const amount = Number(match[1]) * (match[2] === 's' ? 1000 : 1)

  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

const KEYWORDS = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}

/**
 * A CSS easing, as a function from progress to how far along the count is.
 *
 * Read from the same custom property the other transitions use, so
 * `transition="number ease-back"` overshoots the target and settles back onto it,
 * exactly as a slide with that easing does. That is the stylesheet staying the one
 * place motion is decided, which it is for everything else.
 *
 * `linear`, the keywords and `cubic-bezier()` are understood. Anything else --
 * `steps()`, the stop-list form of `linear()` -- counts linearly rather than
 * failing, because a count that runs evenly is still a count.
 *
 * @param {string} text
 * @returns {(progress: number) => number}
 */
export function easingOf(text) {
  const value = String(text ?? '').trim()

  if (Object.hasOwn(KEYWORDS, value)) return bezier(...KEYWORDS[value])

  const curve = /^cubic-bezier\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)$/.exec(value)

  if (curve) {
    const points = curve.slice(1).map(Number)

    if (points.every(Number.isFinite)) return bezier(...points)
  }

  return (progress) => progress
}

/**
 * A cubic Bézier from (0,0) to (1,1), solved for y at a given x.
 *
 * x is time and y is distance, so the curve has to be inverted: find the t whose x
 * is the progress, then read y at that t. Newton's method gets there in a few
 * steps on any sane curve; bisection catches the flat spots where it stalls.
 */
function bezier(x1, y1, x2, y2) {
  const along = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
  const slope = (a, b, t) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t

  return (progress) => {
    if (progress <= 0) return 0
    if (progress >= 1) return 1

    let t = progress

    for (let step = 0; step < 8; step += 1) {
      const error = along(x1, x2, t) - progress

      if (Math.abs(error) < 1e-6) return along(y1, y2, t)

      const gradient = slope(x1, x2, t)

      if (Math.abs(gradient) < 1e-6) break

      t -= error / gradient
    }

    let low = 0
    let high = 1

    t = progress

    for (let step = 0; step < 40; step += 1) {
      const x = along(x1, x2, t)

      if (Math.abs(x - progress) < 1e-6) break
      if (x < progress) low = t
      else high = t

      t = (low + high) / 2
    }

    return along(y1, y2, t)
  }
}
