import { describe, expect, it } from 'vitest'

import { tallyOf } from '../src/toolkits/tally'

// Three demolitions is three icons, not the word three. What the row looks like is
// the studio's; how long it is, and how much of it is filled, is this.

describe('counting', () => {
  it('draws one mark per unit', () => {
    expect(tallyOf({ value: 3 })).toMatchObject({ marks: 3, filled: 3, over: false })
  })

  it('draws nothing at zero', () => {
    // Zero demolitions is an empty space, not a placeholder. The row is the count.
    expect(tallyOf({ value: 0 })).toMatchObject({ marks: 0, filled: 0 })
  })

  it('reads a count that arrived as text', () => {
    // Stores, feeds and typed fields all hand back strings sooner or later.
    expect(tallyOf({ value: '4' })).toMatchObject({ marks: 4, filled: 4 })
  })

  it('treats nothing at all as nothing rather than as an error', () => {
    for (const value of [undefined, null, '', 'nonsense', NaN]) {
      expect(tallyOf({ value })).toMatchObject({ marks: 0, filled: 0, count: 0 })
    }
  })

  it('will not draw a negative number of icons', () => {
    expect(tallyOf({ value: -3 })).toMatchObject({ marks: 0, filled: 0, count: 0 })
  })

  it('rounds a fractional count down rather than drawing half a mark', () => {
    expect(tallyOf({ value: 2.9 })).toMatchObject({ marks: 2, filled: 2 })
  })
})

describe('the bound', () => {
  it('clamps a count too large to read', () => {
    expect(tallyOf({ value: 40 })).toMatchObject({ marks: 12, filled: 12 })
  })

  it('still reports what the count really was, so a studio can say so', () => {
    // Clamping silently would be a lie on air: forty demolitions would read as
    // twelve. The row is capped; the number is not.
    expect(tallyOf({ value: 40 })).toMatchObject({ count: 40, over: true })
  })

  it('takes a tighter bound', () => {
    expect(tallyOf({ value: 9, max: 5 })).toMatchObject({ marks: 5, filled: 5, count: 9, over: true })
  })

  it('lets a studio ask for no bound at all', () => {
    expect(tallyOf({ value: 30, max: 0 })).toMatchObject({ marks: 30, filled: 30, over: false })
  })
})

describe('out of a fixed number', () => {
  it('draws the whole race and fills what has been won', () => {
    expect(tallyOf({ value: 1, of: 3 })).toMatchObject({ marks: 3, filled: 1, over: false })
  })

  it('draws the empties before anything has been won', () => {
    // The difference from counting: the row holds its width from the first frame,
    // so nothing beside it moves as the series runs.
    expect(tallyOf({ value: 0, of: 3 })).toMatchObject({ marks: 3, filled: 0 })
  })

  it('fills the last one without overflowing it', () => {
    expect(tallyOf({ value: 3, of: 3 })).toMatchObject({ marks: 3, filled: 3, over: false })
  })

  it('cannot be filled past its length by a feed that has lost count', () => {
    expect(tallyOf({ value: 7, of: 3 })).toMatchObject({ marks: 3, filled: 3, count: 7, over: true })
  })

  it('ignores a race length that is not one', () => {
    for (const of of [0, -2, 'best of five', undefined, null]) {
      expect(tallyOf({ value: 2, of })).toMatchObject({ marks: 2, filled: 2 })
    }
  })

  it('is not bounded by max, because its length was asked for outright', () => {
    expect(tallyOf({ value: 20, of: 20 })).toMatchObject({ marks: 20, filled: 20 })
  })
})
