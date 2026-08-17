/**
 * Lowercase, ASCII-ish, hyphen-separated. Used to turn an operator's free text
 * into something that can appear in a filename -- "Boise State" -> "boise-state"
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
