// Which picture a slideshow is showing, as arithmetic on the clock.
//
// Not a counter that something increments. A counter belongs to whichever tab
// happens to be running it, and a show has more than one: two browser sources on
// the same graphic, a preview beside the programme, a second machine in the room.
// Every one of them would advance on its own schedule and they would drift apart
// within minutes -- visibly, because a cross-fade between two different pictures
// on two outputs of the same scene is the sort of thing an audience notices even
// when nobody can say what is wrong.
//
// Reading the picture off the time instead means nothing has to agree with
// anything. Feed these the time in the room -- `Date.now()` plus the offset the
// sync layer already maintains -- and every output lands on the same picture at
// the same instant, with no coordination, no leader, and nothing to resynchronise
// after a browser source is closed and reopened mid-show.

/** Which dwell period a moment falls in. The clock is the counter. */
export function slideTick({ now, every }) {
  if (!(every > 0)) return 0

  return Math.floor(now / every)
}

/** How long until the next one, for scheduling a re-render on the boundary. */
export function untilNextSlide({ now, every }) {
  if (!(every > 0)) return 0

  return every - (((now % every) + every) % every)
}

/**
 * mulberry32. Small, fast, and -- the only property that matters here -- integer
 * arithmetic all the way down, so every machine draws the same numbers from the
 * same seed. A generator that touched floats could differ between engines, and a
 * shuffle that differs between machines is two outputs showing two pictures.
 */
function random(seed) {
  let state = (seed + 0x9e3779b9) | 0

  return () => {
    state = (state + 0x6d2b79f5) | 0

    let t = state

    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates, seeded by which pass through the deck this is. */
function shuffled(count, pass) {
  const order = Array.from({ length: count }, (_, i) => i)
  const next = random(pass * 2654435761 + count)

  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))

    ;[order[i], order[j]] = [order[j], order[i]]
  }

  return order
}

/**
 * One pass through the deck, with the seam looked after.
 *
 * A fresh shuffle each pass can put a picture at the end of one and the start of
 * the next, which on air is the same image held for twice the dwell and reads as
 * the slideshow having stalled. When that happens the first two are swapped
 * rather than the pass reshuffled -- deliberately, because a swap leaves the
 * *end* of the pass where the unadjusted shuffle put it, so the next pass can
 * check the seam against a plain `shuffled()` without needing to know this one
 * was adjusted. Every machine reaches the same answer without talking.
 */
function deck(count, pass) {
  const order = shuffled(count, pass)

  if (pass > 0 && order[0] === shuffled(count, pass - 1).at(-1)) {
    ;[order[0], order[1]] = [order[1], order[0]]
  }

  return order
}

/**
 * The picture for a dwell period.
 *
 * `sequence` is the list in order, looping. `shuffle` is a permutation per pass:
 * every picture is shown once before any is shown twice, which is what people
 * mean by random and is not what random does -- an independent pick would show
 * the same wallpaper twice running often enough to look like a fault.
 *
 * Fewer than three pictures cannot be shuffled without repeating across the seam
 * -- two of them alternate whatever you do -- so they fall back to sequence
 * rather than pretending.
 */
export function slideFor({ tick, count, order = 'sequence' }) {
  if (!count) return 0

  const at = ((tick % count) + count) % count

  if (order !== 'shuffle' || count < 3) return at

  return deck(count, Math.floor(tick / count))[at]
}
