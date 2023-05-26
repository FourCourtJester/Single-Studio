export function clockDifference(now, later) {
  const [h, m] = later.split(':')

  // Future time on a new day
  return now.getTime() + clockToTime(`${24 + Number(h) - now.getHours()}:${Number(m) - now.getMinutes()}`) - now.getSeconds() * 1000
}

export function clockToTime(t) {
  if (t === undefined) return 0

  const timeParts = t.toString().split(':')
  const h = 60 * 60 * 1000

  // Add up the time
  // Entries with no colon returns in seconds
  // Adds up to days correctly
  return timeParts.reduce((time, part, i) => {
    const amt = part * h
    return time + (i > 0 ? amt / 60 ** i : amt)
  }, 0)
}

export function dateDifference(now, later) {
  return now.getTime() + later.getTime() - now.getTime()
}

export function stringToTime(t) {
  if (t === undefined) return 0

  const timeParts = t.toString().split(':')
  let s = 0
  let m = 1

  // Add up the time
  // Entries with no colon returns in seconds
  // Adds up to days correctly
  while (timeParts.length) {
    s += m * +timeParts.pop()
    m *= 60
  }

  // Return seconds
  return Number.isInteger(s) ? s : 0
}

export function timeToString(t) {
  if (!t || t <= 0) return '00:00'

  const d = new Date(t).toISOString()
  return t >= 3600000 ? d.slice(11, -5) : d.slice(14, -5)
}
