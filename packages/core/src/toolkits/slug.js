/**
 * Lowercase, ASCII-ish, hyphen-separated. Used to turn an operator's free text
 * into something that can appear in a filename -- "Single Studio" -> "single-studio"
 * for a logo lookup.
 */
export function slugify(value) {
  return (
    String(value ?? '')
      .normalize('NFKD')
      // Strip combining marks so accented letters reduce to their base form.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

/**
 * The other direction: `lower-third` -> `Lower Third`.
 *
 * A source is registered under a key that has to survive a URL, so it is written
 * the way a URL wants it -- lowercase and hyphenated. That is not what an operator
 * should be reading in a list, or what OBS should be showing in a scene, so the
 * display name is derived rather than declared. One name to keep in step instead of
 * two, and a studio that adds a source gets a readable label without doing anything.
 *
 * Hyphens and underscores are word breaks; a run of digits stays attached to the
 * word it follows, so `week-1` is "Week 1" rather than "Week 1" with a stray break.
 */
export function titleize(value) {
  // A slash groups rather than joins: `lower-thirds/single` is two things, and an
  // OBS scene list reads better keeping the group than mashing it into one word.
  if (String(value ?? '').includes('/')) {
    return String(value)
      .split('/')
      .filter(Boolean)
      .map(titleize)
      .join(' / ')
  }

  return String(value ?? '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
