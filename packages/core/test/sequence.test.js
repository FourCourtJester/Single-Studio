import { describe, expect, it } from 'vitest'

import { cueAt } from '../src/toolkits/sequence'

// The item on screen is arithmetic on how long the sequence has run, so anything
// that agrees on when it started agrees on where it is. These check the arithmetic;
// the component only feeds it elapsed time.

const at = (elapsed, durations, loop) => cueAt({ elapsed, durations, loop })

describe('which item a sequence is on', () => {
  it('holds each item for its own duration, in order', () => {
    const durations = [10_000, 8000, 15_000]

    expect(at(0, durations).index).toBe(0)
    expect(at(9999, durations).index).toBe(0)
    expect(at(10_000, durations).index).toBe(1)
    expect(at(17_999, durations).index).toBe(1)
    expect(at(18_000, durations).index).toBe(2)
    expect(at(32_999, durations).index).toBe(2)
  })

  it('goes round again after the last item, one loop being exactly the durations added up', () => {
    const durations = [10_000, 8000, 15_000]

    expect(at(33_000, durations).index).toBe(0)
    expect(at(33_000 * 1000 + 10_000, durations).index).toBe(1)
  })

  it('says how long until the next item, so a render can be scheduled on the boundary', () => {
    expect(at(0, [10_000, 8000]).until).toBe(10_000)
    expect(at(9999, [10_000, 8000]).until).toBe(1)
    expect(at(12_000, [10_000, 8000]).until).toBe(6000)
  })

  it('lands on the right item after a late wake-up, rather than the next one in line', () => {
    // A tab asleep through two whole items: a chain of timeouts would show item 1
    // next, and the room has moved on to item 0 of the next loop.
    expect(at(18_500, [10_000, 8000]).index).toBe(0)
  })
})

describe('a sequence that plays once', () => {
  it('holds the last item when it has run its course, and stops scheduling', () => {
    expect(at(17_999, [10_000, 8000], false)).toEqual({ index: 1, until: 1 })
    expect(at(18_000, [10_000, 8000], false)).toEqual({ index: 1, until: Infinity })
    expect(at(1e9, [10_000, 8000], false)).toEqual({ index: 1, until: Infinity })
  })
})

describe('items left out of the rotation', () => {
  it('skips an item of no duration, without moving the ones either side', () => {
    const durations = [10_000, 0, 8000]

    expect(at(9999, durations).index).toBe(0)
    expect(at(10_000, durations).index).toBe(2)
    expect(at(18_000, durations).index).toBe(0)
  })

  it('holds the last item that plays, not the last item, at the end of a single pass', () => {
    expect(at(1e9, [10_000, 8000, 0], false).index).toBe(1)
  })

  it('shows nothing when no item has any duration', () => {
    expect(at(5000, [0, 0])).toEqual({ index: -1, until: Infinity })
    expect(at(5000, [])).toEqual({ index: -1, until: Infinity })
  })

  it('holds a lone item without asking to be woken for it every loop', () => {
    expect(at(1e9, [10_000])).toEqual({ index: 0, until: Infinity })
    expect(at(1e9, [0, 10_000, 0])).toEqual({ index: 1, until: Infinity })
  })
})

describe('times that cannot be trusted', () => {
  it('starts at the first item when the start is somehow in the future', () => {
    expect(at(-500, [10_000, 8000])).toEqual({ index: 0, until: 10_000 })
  })

  it('starts at the first item rather than showing nothing when the time is not a number', () => {
    expect(at(Number.NaN, [10_000, 8000]).index).toBe(0)
  })
})
