import { describe, expect, it } from 'vitest'

import * as Doc from '../src/velcro/doc'
import { apply, mutations } from '../src/velcro/mutations'

// What a high-rate feed costs the document.
//
// A plugin reading a game speaks at whatever rate the game speaks: Rocket League
// ships `UpdateState` at up to 120 a second and 30 is the usual setting. That
// number sounds alarming and mostly is not, because `writeOne` compares before it
// writes -- but "mostly" is doing work there, and the difference between the cases
// is the whole guidance a plugin author needs.
//
// These are assertions rather than a benchmark. The elision is load-bearing now
// that plugins exist: if somebody removes the comparison in `writeOne`, the first
// case here goes from one frame to three hundred, and nothing else in the suite
// would notice.

const run = (doc, name, payload) => apply(doc, mutations, name, payload)

/** Frames and bytes a document actually produced. */
const cost = (doc, fn, ticks) => {
  let frames = 0
  let bytes = 0

  const onUpdate = (update) => {
    frames += 1
    bytes += update.byteLength
  }

  doc.on('update', onUpdate)
  for (let i = 0; i < ticks; i += 1) fn(i)
  doc.off('update', onUpdate)

  return { frames, bytes }
}

const RATE = 30
const SECONDS = 10
const TICKS = RATE * SECONDS

describe(`a feed at ${RATE}Hz, over ${SECONDS} seconds`, () => {
  it('costs one frame for fields that are not changing', () => {
    // The case that matters most, because it is the common one. A scoreboard's
    // names and scores are re-sent on every tick and change on almost none of them.
    const doc = Doc.createDoc()

    const { frames } = cost(
      doc,
      () =>
        run(doc, 'set', {
          'variables.blue.name': 'Blue',
          'variables.orange.name': 'Orange',
          'variables.blue.score': 2,
          'variables.orange.score': 1,
        }),
      TICKS,
    )

    // One write, then 299 comparisons that decided there was nothing to do. No
    // update frame, no IndexedDB write, no observer, no re-render on air.
    expect(frames).toBe(1)
  })

  it('costs one more frame per thing that actually happened', () => {
    const doc = Doc.createDoc()

    const { frames } = cost(doc, (i) => run(doc, 'set', { 'variables.blue.score': i < TICKS / 2 ? 2 : 3 }), TICKS)

    expect(frames).toBe(2)
  })

  it('follows the rate of the value, not the rate of the feed', () => {
    // A clock ticking once a second, re-sent thirty times a second, costs ten
    // frames over ten seconds rather than three hundred.
    const doc = Doc.createDoc()

    const { frames } = cost(doc, (i) => run(doc, 'set', { 'variables.clock': 300 - Math.floor(i / RATE) }), TICKS)

    expect(frames).toBe(SECONDS)
  })

  it('costs a frame per tick for telemetry that genuinely changes every tick', () => {
    // The case to design around. Boost and speed for six players is roughly five
    // kilobytes a second, every byte of it persisted and replicated -- for numbers
    // that are stale before anybody reads them.
    //
    // Not a bug and not fixable by comparison: the values really are different.
    // The answer is upstream, in what a studio chooses to store.
    const doc = Doc.createDoc()

    const { frames, bytes } = cost(
      doc,
      (i) => {
        const payload = {}

        for (let player = 0; player < 6; player += 1) {
          payload[`variables.players.${player}.boost`] = (i * 7 + player) % 100
          payload[`variables.players.${player}.speed`] = 800 + ((i * 13 + player) % 500)
        }

        return run(doc, 'set', payload)
      },
      TICKS,
    )

    expect(frames).toBe(TICKS)
    expect(bytes / SECONDS).toBeGreaterThan(4000)
  })
})
