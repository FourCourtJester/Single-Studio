import { describe, expect, it } from 'vitest'

import { countable, durationOf, easingOf, readNumber, writeNumber } from '../src/toolkits/count'

// The arithmetic behind `transition="number"`. The motion itself is checked in a
// real browser by the end-to-end suite.

describe('reading the number out of a value', () => {
  it('finds a plain one', () => {
    expect(readNumber('1500')).toEqual({ prefix: '', suffix: '', value: 1500, decimals: 0, grouped: false })
  })

  it('keeps the words around it, so the count is spelled like the target', () => {
    expect(readNumber('$1,500.50 raised')).toEqual({ prefix: '$', suffix: ' raised', value: 1500.5, decimals: 2, grouped: true })
  })

  it('reads a negative', () => {
    expect(readNumber('-12').value).toBe(-12)
  })

  it('refuses anything that is not one number, so it is swapped instead', () => {
    expect(readNumber('Home')).toBeNull()
    expect(readNumber('')).toBeNull()
    expect(readNumber('2 - 1')).toBeNull()
    expect(readNumber(undefined)).toBeNull()
  })

  it('does not take a dot in the thousands for a decimal point it cannot tell apart', () => {
    // "1.500" is one and a half here, not fifteen hundred: only commas group.
    expect(readNumber('1.500').value).toBe(1.5)
  })
})

describe('writing a frame of the count', () => {
  const shape = (text) => readNumber(text)

  it('writes in the target’s shape', () => {
    expect(writeNumber(1237.4, shape('$1,500 raised'))).toBe('$1,237 raised')
    expect(writeNumber(12.345, shape('40.50'))).toBe('12.35')
    expect(writeNumber(1234567, shape('1,000'))).toBe('1,234,567')
  })

  it('ends on exactly the text the store holds', () => {
    for (const text of ['1500', '$1,500.50 raised', '-12', '0.05%', '1,000,000']) {
      const read = readNumber(text)

      expect(writeNumber(read.value, read)).toBe(text)
    }
  })

  it('never shows a minus sign on zero', () => {
    expect(writeNumber(-0.2, shape('10'))).toBe('0')
  })
})

describe('whether two values can be counted between', () => {
  it('can when only the number changes', () => {
    expect(countable(readNumber('12 pts'), readNumber('40 pts'))).toBe(true)
  })

  it('cannot when the words change, because no frame between would be spelled right', () => {
    expect(countable(readNumber('1st'), readNumber('2nd'))).toBe(false)
  })

  it('cannot when either side is not a number', () => {
    expect(countable(readNumber('TBD'), readNumber('40'))).toBe(false)
    expect(countable(readNumber('40'), null)).toBe(false)
  })
})

describe('timing, read from the stylesheet', () => {
  it('understands seconds and milliseconds', () => {
    expect(durationOf('1.2s')).toBe(1200)
    expect(durationOf(' 800ms ')).toBe(800)
  })

  it('treats anything else as no count at all', () => {
    expect(durationOf('')).toBe(0)
    expect(durationOf('fast')).toBe(0)
    expect(durationOf('-1s')).toBe(0)
  })
})

describe('easing, read from the same property as every other transition', () => {
  it('starts at the start and ends at the end, whatever the curve', () => {
    for (const curve of ['linear', 'ease', 'ease-out', 'cubic-bezier(0.34, 1.56, 0.64, 1)', 'steps(4)']) {
      const ease = easingOf(curve)

      expect(ease(0)).toBe(0)
      expect(ease(1)).toBe(1)
    }
  })

  it('front-loads an ease-out, so the count slows as it lands', () => {
    const ease = easingOf('cubic-bezier(0.16, 1, 0.3, 1)')

    expect(ease(0.25)).toBeGreaterThan(0.7)
    expect(ease(0.75)).toBeLessThan(1)
  })

  it('overshoots with ease-back, so the count passes the target and settles', () => {
    const ease = easingOf('cubic-bezier(0.34, 1.56, 0.64, 1)')
    const peak = Math.max(...Array.from({ length: 99 }, (_, i) => ease((i + 1) / 100)))

    expect(peak).toBeGreaterThan(1.05)
  })

  it('agrees with the curve CSS draws, at its midpoint', () => {
    // cubic-bezier(0.42, 0, 0.58, 1) is symmetric, so halfway in time is halfway there.
    expect(easingOf('ease-in-out')(0.5)).toBeCloseTo(0.5, 5)
  })

  it('counts evenly through anything it does not understand', () => {
    expect(easingOf('steps(4)')(0.3)).toBeCloseTo(0.3)
    expect(easingOf(undefined)(0.3)).toBeCloseTo(0.3)
  })
})
