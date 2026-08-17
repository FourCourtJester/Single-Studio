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

/** `mm:ss`, growing to `h:mm:ss` and `d:hh:mm:ss` only when needed. */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return '00:00'

  const total = Math.ceil(ms / 1000)
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600) % 24
  const days = Math.floor(total / 86400)

  const pad = (n) => String(n).padStart(2, '0')

  if (days) return `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  if (hours) return `${hours}:${pad(minutes)}:${pad(seconds)}`

  return `${pad(minutes)}:${pad(seconds)}`
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
