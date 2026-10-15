// Which item of a sequence is current, as arithmetic on how long it has run.
//
// Not a chain of timeouts -- show the first, wait its duration, show the next. A
// chain is a counter, it belongs to the tab running it, and every timeout it waits
// on is late by however long that tab was busy or throttled. The lateness adds up
// along the chain, so two outputs of one graphic that started together drift apart
// a little every item.
//
// Reading the position off the elapsed time instead means a late wake-up lands on
// the right item rather than the next one in line, and anything that agrees on
// when the sequence started agrees on where it is now.

/**
 * The item on screen, and how long until that changes.
 *
 * A duration is the time an item is the current one -- its entrance included, its
 * exit not, because the exit plays while the next item is already current. That is
 * what makes one loop exactly the sum of the durations. See
 * docs/internal/sequence.md.
 *
 * @param {object} input
 * @param {number} input.elapsed - milliseconds since the sequence started
 * @param {number[]} input.durations - milliseconds each item is current; nought or less leaves it out
 * @param {boolean} [input.loop] - go round again after the last item, rather than holding it
 * @returns {{ index: number, until: number }} `index` is -1 when no item can be on; `until` is
 *   Infinity when nothing will change without the inputs changing
 */
export function cueAt({ elapsed, durations, loop = true }) {
  const playing = durations.flatMap((duration, index) => (duration > 0 ? [index] : []))

  if (!playing.length) return { index: -1, until: Infinity }

  const last = playing.at(-1)

  // One item looping is one item held. A boundary every loop would re-render a
  // graphic to show it exactly what it is already showing.
  if (loop && playing.length === 1) return { index: last, until: Infinity }

  const total = playing.reduce((sum, index) => sum + durations[index], 0)
  let at = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0

  if (loop) at %= total
  else if (at >= total) return { index: last, until: Infinity }

  for (const index of playing) {
    if (at < durations[index]) return { index, until: durations[index] - at }

    at -= durations[index]
  }

  // Only reachable through rounding at the very end of a loop of fractional
  // milliseconds. Nought asks the caller to look again at once, which lands on the
  // first item of the next loop.
  return { index: last, until: 0 }
}
