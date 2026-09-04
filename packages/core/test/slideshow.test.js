import { describe, expect, it } from 'vitest'

import { picturesFor, slideFor, slideTick, untilNextSlide } from '../src/toolkits/slideshow'

// The picture is arithmetic on the clock rather than a counter somebody advances,
// which is what lets two browser sources and two machines show the same one
// without coordinating. These check the arithmetic; the component only feeds it
// room time.

const run = (count, ticks, order = 'shuffle') => Array.from({ length: ticks }, (_, tick) => slideFor({ tick, count, order }))

describe('which dwell period a moment falls in', () => {
  it('counts periods from the epoch, so any clock agrees with any other', () => {
    expect(slideTick({ now: 0, every: 9000 })).toBe(0)
    expect(slideTick({ now: 8999, every: 9000 })).toBe(0)
    expect(slideTick({ now: 9000, every: 9000 })).toBe(1)
    expect(slideTick({ now: 90_000, every: 9000 })).toBe(10)
  })

  it('says how long is left, so a render can be scheduled on the boundary', () => {
    expect(untilNextSlide({ now: 0, every: 9000 })).toBe(9000)
    expect(untilNextSlide({ now: 8999, every: 9000 })).toBe(1)
    expect(untilNextSlide({ now: 9000, every: 9000 })).toBe(9000)
  })

  it('refuses to divide by a dwell of nothing', () => {
    expect(slideTick({ now: 5, every: 0 })).toBe(0)
    expect(untilNextSlide({ now: 5, every: 0 })).toBe(0)
    expect(slideTick({ now: 5, every: -1 })).toBe(0)
  })
})

describe('in sequence', () => {
  it('is the list, looping', () => {
    expect(run(4, 9, 'sequence')).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0])
  })

  it('holds at the first picture when there is only one', () => {
    expect(run(1, 4, 'sequence')).toEqual([0, 0, 0, 0])
  })

  it('survives a clock behind the epoch rather than indexing backwards', () => {
    // A machine whose offset drags it before its own start would otherwise ask
    // for element -1 and get nothing on air.
    expect(slideFor({ tick: -1, count: 4, order: 'sequence' })).toBe(3)
    expect(slideFor({ tick: -5, count: 4, order: 'sequence' })).toBe(3)
  })

  it('has nothing to show for an empty list', () => {
    expect(slideFor({ tick: 7, count: 0 })).toBe(0)
  })
})

describe('shuffled', () => {
  it('shows every picture once before showing any of them twice', () => {
    for (const count of [3, 5, 8, 17]) {
      const pass = run(count, count)

      expect([...pass].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, i) => i))
    }
  })

  it('deals a different order each pass', () => {
    const first = run(8, 8).join()
    const second = run(8, 16).slice(8).join()

    expect(second).not.toEqual(first)
  })

  it('never shows the same picture twice running, including across a pass', () => {
    // The seam is the whole reason this is not just a fresh shuffle per pass: a
    // picture last in one deal and first in the next is held for two dwells and
    // reads as the slideshow having stalled.
    for (const count of [3, 4, 5, 6, 7, 11]) {
      const long = run(count, count * 60)

      expect(long.findIndex((slide, i) => i > 0 && slide === long[i - 1])).toBe(-1)
    }
  })

  it('gives the same answer to everyone, which is the point', () => {
    // Two machines, no contact, one picture. Deterministic from tick and count
    // alone -- nothing here reads a clock, a random seed, or a stored value.
    for (const tick of [0, 3, 41, 1000, 999_999]) {
      expect(slideFor({ tick, count: 7, order: 'shuffle' })).toBe(slideFor({ tick, count: 7, order: 'shuffle' }))
    }
  })

  it('falls back to sequence below three, where a shuffle cannot help', () => {
    // Two pictures alternate however they are dealt; pretending to shuffle them
    // would only risk showing one of them twice in a row.
    expect(run(2, 6)).toEqual([0, 1, 0, 1, 0, 1])
    expect(run(1, 3)).toEqual([0, 0, 0])
  })

  it('deals a full deck for a long run rather than favouring a few', () => {
    const seen = new Map()

    for (const slide of run(6, 600)) seen.set(slide, (seen.get(slide) ?? 0) + 1)

    expect(seen.size).toBe(6)
    // 100 each in exact passes; the seam swap moves nothing between passes.
    expect([...seen.values()].every((n) => n === 100)).toBe(true)
  })
})

describe('which pictures play', () => {
  const here = (key) => ({ key, here: true })
  const elsewhere = (key) => ({ key, here: false })
  const library = [here('slides/a'), here('slides/b'), elsewhere('slides/c'), here('other/d')]

  it('plays a group, in the order the library holds it', () => {
    expect(picturesFor({ prefix: 'slides/', assets: library })).toEqual(['asset:slides/a', 'asset:slides/b'])
  })

  it('leaves out what this machine cannot paint', () => {
    // The library replicates what exists to everyone; a file dropped on a
    // producer's laptop has bytes that live only there, and a slide with nothing
    // behind it is a blank on air.
    expect(picturesFor({ prefix: 'slides/', assets: library })).not.toContain('asset:slides/c')
  })

  it('plays nothing rather than everything when no group was named', () => {
    expect(picturesFor({ assets: library })).toEqual([])
  })

  it('lets a pick beat the group', () => {
    expect(picturesFor({ picked: ['asset:other/d'], prefix: 'slides/', assets: library })).toEqual(['asset:other/d'])
  })

  it('keeps the pick in the order it was picked, not the order the library holds', () => {
    expect(picturesFor({ picked: ['asset:slides/b', 'asset:slides/a'], prefix: 'slides/', assets: library })).toEqual(['asset:slides/b', 'asset:slides/a'])
  })

  it('falls back to the group only when nothing was picked at all', () => {
    expect(picturesFor({ picked: [], prefix: 'slides/', assets: library })).toEqual(['asset:slides/a', 'asset:slides/b'])
  })

  it('does not quietly play the group when the pick is unshowable here', () => {
    // The bug this covers: filtering before the fallback made "picked nothing" and
    // "picked things this machine has not got" the same question. A producer's
    // laptop would answer it by playing the whole folder instead of the pick --
    // two outputs, two different shows, and neither of them says why.
    expect(picturesFor({ picked: ['asset:slides/c'], prefix: 'slides/', assets: library })).toEqual([])
  })

  it('passes a plain URL through, since nothing local has to hold it', () => {
    expect(picturesFor({ picked: ['https://example.com/a.png'], assets: library })).toEqual(['https://example.com/a.png'])
  })

  it('caps how many play', () => {
    expect(picturesFor({ prefix: 'slides/', assets: library, limit: 1 })).toEqual(['asset:slides/a'])
    expect(picturesFor({ prefix: 'slides/', assets: library, limit: 0 })).toHaveLength(2)
  })

  it('has nothing to play with an empty library', () => {
    expect(picturesFor({ prefix: 'slides/', assets: [] })).toEqual([])
    expect(picturesFor({})).toEqual([])
  })
})
