/** Parse `90`, `1:30`, or `1:02:03` into milliseconds. */
export function parseDuration(input) {
  if (input === undefined || input === null || input === '') return 0
  if (typeof input === 'number') return input * 1000

  const parts = String(input).split(':').map(Number)

  if (parts.some((part) => !Number.isFinite(part))) return 0

  let seconds = 0
  let scale = 1

  while (parts.length) {
    seconds += scale * parts.pop()
    scale *= 60
  }

  return seconds * 1000
}

/**
 * `mm:ss`, growing to `h:mm:ss` and `d:hh:mm:ss` only when needed.
 *
 * Rounding runs the way the clock does. A countdown rounds up, so 0.4s left still
 * reads 00:01 and the zero lands exactly when time is actually out. Counting up
 * wants the opposite: floor, so a stopwatch reads 00:00 for its first second rather
 * than jumping to 00:01 the instant it is pressed.
 */
export function formatDuration(ms, { round = 'ceil' } = {}) {
  if (!ms || ms <= 0) return '00:00'

  const total = round === 'floor' ? Math.floor(ms / 1000) : Math.ceil(ms / 1000)
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600) % 24
  const days = Math.floor(total / 86400)

  const pad = (n) => String(n).padStart(2, '0')

  if (days) return `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  if (hours) return `${hours}:${pad(minutes)}:${pad(seconds)}`

  return `${pad(minutes)}:${pad(seconds)}`
}

/**
 * The whole second a stored clock currently displays.
 *
 * This is what the view polls. Deriving one integer means a clock can be checked
 * far more often than it changes, and only re-rendered when this number moves --
 * which is what keeps a tick landing on time without the cost of animating one.
 * Rounding matches formatDuration in each direction, or the poll would disagree
 * with the text it is meant to be tracking.
 */
export function displayedSeconds(timer, now = Date.now()) {
  if (!timer) return 0

  if (timer.from) return Math.floor(Math.max(0, now - timer.from) / 1000)
  if (timer.elapsed !== undefined) return Math.floor(Math.max(0, Number(timer.elapsed)) / 1000)
  if (timer.ts) return Math.ceil(Math.max(0, timer.ts - now) / 1000)

  return 0
}

/** Milliseconds until the next occurrence of a `HH:MM` wall-clock time. */
export function untilClockTime(clock, now = new Date()) {
  const [hours, minutes] = String(clock).split(':').map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0

  const target = new Date(now)

  target.setHours(hours, minutes, 0, 0)

  if (target <= now) target.setDate(target.getDate() + 1)

  return target.getTime() - now.getTime()
}
