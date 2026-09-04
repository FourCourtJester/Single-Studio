// How many marks a tally shows, and how many of them are filled.
//
// Pulled out of the component because it is the part with edges: a count that
// arrived as text, a count that is negative, a count larger than there is room
// for, a race whose length an operator can change mid-series. None of that needs
// a browser to test, and all of it is what goes wrong on air.

/** The bound past which a row of identical icons is not a count anyone reads. */
export const MARKS = 12

/**
 * @param {object} input
 * @param {unknown} input.value - the stored count, however it was stored
 * @param {unknown} [input.of] - how many marks there are in total, filled or not
 * @param {number} [input.max] - the most marks to draw when there is no `of`; 0 for no bound
 */
export function tallyOf({ value, of, max = MARKS }) {
  // `Number('')` is 0 and `Number(undefined)` is NaN, and a graphic wants the same
  // thing from both. A count is also whole: 2.5 demolitions is a feed being wrong,
  // and half an icon is a worse way to say so than two.
  const raw = Math.floor(Number(value))
  const count = Number.isFinite(raw) ? Math.max(0, raw) : 0
  const total = Math.floor(Number(of))
  const race = Number.isFinite(total) && total > 0 ? total : 0

  // With a race, the row is a fixed length and the count fills it. Without one, the
  // row *is* the count -- bounded, because an operator typing 40 should cost a
  // clamp rather than the layout.
  const marks = race || (max > 0 ? Math.min(count, max) : count)

  return { marks, filled: Math.min(count, marks), count, over: count > marks }
}
