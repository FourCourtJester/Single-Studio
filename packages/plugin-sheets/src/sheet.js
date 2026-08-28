// A Google Sheets response, turned into rows a studio can use.
//
// Pure, so the whole shape of the thing is testable without a network, an API key,
// or a spreadsheet. What is left in the plugin is the polling.
//
// Sheets is unlike the other feeds in one way that decides the design: it does not
// push. There is no socket and no notification, so the plugin asks on a timer, and
// every design choice here follows from wanting to ask as rarely as possible and
// say nothing when the answer has not changed.

/**
 * The API omits trailing empty cells rather than padding them, so a row whose last
 * two columns are blank comes back short. Reading by index then silently shifts
 * every value left of a gap.
 *
 * @param {string[][]} values
 * @param {number} width
 */
const rectangular = (values, width) => values.map((row) => Array.from({ length: width }, (_, index) => row?.[index] ?? ''))

/** The width of the widest row, which is the only honest column count. */
const widthOf = (values) => values.reduce((widest, row) => Math.max(widest, row?.length ?? 0), 0)

/**
 * A header cell as a key somebody would type.
 *
 * `Team Name` becomes `teamName`, because a graphic writing `row['Team Name']` is a
 * graphic that breaks when somebody tidies the capitalisation of a spreadsheet.
 */
export const keyOf = (label, index) => {
  const cleaned = String(label ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_match, next) => (next ? next.toUpperCase() : ''))

  const key = cleaned.charAt(0).toLowerCase() + cleaned.slice(1)

  // An unnamed column still needs a name, or two of them collide on ''.
  return key || `column${index + 1}`
}

/**
 * Turn `{ values: [...] }` into rows.
 *
 * @param {object} body The API response.
 * @param {object} [options]
 * @param {boolean} [options.header] Treat the first row as column names.
 * @returns {{ rows: Array<object|string[]>, header: string[]|null, count: number }}
 */
export function parse(body, { header = true } = {}) {
  const values = Array.isArray(body?.values) ? body.values : []

  if (!values.length) return { rows: [], header: header ? [] : null, count: 0 }

  const width = widthOf(values)
  const grid = rectangular(values, width)

  if (!header) return { rows: grid, header: null, count: grid.length }

  const [labels, ...rest] = grid
  const keys = labels.map(keyOf)

  // A row that is entirely blank is a spacer somebody left in the sheet, not a
  // record. Emitting it puts an empty name on air.
  const rows = rest
    .filter((row) => row.some((cell) => String(cell).trim() !== ''))
    .map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ''])))

  return { rows, header: keys, count: rows.length }
}

/**
 * Whether two parses differ.
 *
 * The reason the plugin can poll often without costing anything: an unchanged sheet
 * emits nothing, so a studio's handler -- and every mutation it would make -- runs
 * only when somebody has actually edited something.
 *
 * A string compare rather than a deep walk, because the values are strings from a
 * spreadsheet and the arrays are small. Anything cleverer would be slower.
 */
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * The URL to ask.
 *
 * An API key rather than OAuth, which is what makes this work with no backend: a
 * sheet shared as "anyone with the link can view" is readable with a key, and a key
 * is restrictable by referrer rather than being a secret to keep.
 *
 * @param {object} options
 * @param {string} options.id The spreadsheet id, from its URL.
 * @param {string} options.range A1 notation, e.g. `Standings!A1:D20`.
 * @param {string} options.key
 */
export function urlFor({ id, range, key }) {
  if (!id) throw new Error('A spreadsheet id is needed.')
  if (!key) throw new Error('A Google API key is needed.')

  const where = encodeURIComponent(range || 'A:Z')

  // `UNFORMATTED_VALUE` would hand back numbers and serial dates, which is worse
  // for a broadcast: what the operator typed in the cell is what they expect to see
  // on air, currency symbols and all.
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${where}?key=${encodeURIComponent(key)}&valueRenderOption=FORMATTED_VALUE`
}

/**
 * What a failed request means, in words an operator can act on.
 *
 * Google's messages are accurate and unhelpful at the moment something is wrong on
 * a show -- "The caller does not have permission" does not say that the fix is one
 * sharing setting.
 */
export function explain(status, body) {
  const detail = body?.error?.message ?? ''

  if (status === 403 && /API key not valid/i.test(detail)) return 'That API key was refused. Check it, and that the Sheets API is enabled for its project.'
  if (status === 403) return 'Google refused the request. The sheet has to be shared as "anyone with the link can view".'
  if (status === 404) return 'No spreadsheet with that id. Check the id in the sheet’s URL.'
  if (status === 400 && /Unable to parse range/i.test(detail)) return 'That range was not understood. Use A1 notation, like Standings!A1:D20.'
  if (status === 429) return 'Google is rate limiting this key. Poll less often.'

  return detail || `Google answered ${status}.`
}
