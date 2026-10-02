// What the Twitch graphics, the board and the worker share: how long an alert stays
// up, how each kind looks, and how a chatter's colour is made readable. Plain
// JavaScript, because the worker imports it too and has no business loading React.

/**
 * How long one alert is on screen, in milliseconds.
 *
 * The board's mutation queues alerts back to back using this, and the graphic shows
 * whichever one's slot contains now -- so the two have to agree, which is why it is
 * here rather than in either.
 */
export const ALERT_MS = 6_000

/**
 * Each kind of alert: what it is called on air, and its colour.
 *
 * The demo's accent is sky; the others are picked to be told apart at a glance from
 * across a room, and to sit beside the scoreboard's team colours rather than fight
 * them. Full class names, not built from parts, so Tailwind finds them.
 */
export const KINDS = {
  follow: { label: 'New follower', bar: 'bg-sky-500', text: 'text-sky-400' },
  subscribe: { label: 'New subscriber', bar: 'bg-violet-500', text: 'text-violet-300' },
  resub: { label: 'Resubscribed', bar: 'bg-violet-500', text: 'text-violet-300' },
  gift: { label: 'Gifted subs', bar: 'bg-emerald-500', text: 'text-emerald-300' },
  cheer: { label: 'Cheer', bar: 'bg-amber-500', text: 'text-amber-300' },
  raid: { label: 'Raid', bar: 'bg-rose-500', text: 'text-rose-300' },
}

/**
 * A chatter's own colour, made readable on the dark panel.
 *
 * Twitch lets people pick any colour, and plenty pick a dark blue that disappears on
 * slate-950. So the hue is kept and the lightness raised to at least 65%: everybody
 * is still the colour they chose, just a version of it that can be read on air.
 * Somebody who never chose one gets a steady colour from their name, so they are
 * not a different colour on every message.
 */
export function nameColour(colour, name = '') {
  const hex = /^#?([0-9a-f]{6})$/i.exec(colour ?? '')?.[1]

  if (!hex) {
    let hash = 0

    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0

    return `hsl(${hash % 360} 70% 70%)`
  }

  const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const light = (max + min) / 2
  const delta = max - min
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1))
  let hue = 0

  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
  }

  return `hsl(${Math.round((hue * 60 + 360) % 360)} ${Math.round(saturation * 100)}% ${Math.round(Math.max(light, 0.65) * 100)}%)`
}
