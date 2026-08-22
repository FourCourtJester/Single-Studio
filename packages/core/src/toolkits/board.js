// A leaderboard is stored as one delimited string in a single path, not as many
// paths. That is deliberate: an operator pastes a block of results in from a
// spreadsheet or a tournament bracket, and a single value keeps that paste a
// single edit rather than twenty racing writes.

export const DEFAULT_FIELDS = ['name', 'score']
export const DEFAULT_DELIMITER = '\t'

/**
 * One row of a board: the field names you asked for, mapped to strings.
 *
 * Every field is present and every value is a string -- a column an operator left
 * blank is `''`, never `undefined` -- so a graphic can read `row.score` without
 * guarding first.
 *
 * @typedef {Record<string, string>} BoardRow
 */

/**
 * Options shared by every board helper.
 *
 * @typedef {object} BoardOptions
 * @property {string[]} [fields] Column names, in the order they appear on each line. Defaults to `['name', 'score']`.
 * @property {string} [delimiter] What separates the columns. Defaults to a tab, which is what a spreadsheet paste already uses.
 */

/**
 * Text to rows. Missing trailing columns come back as empty strings, not undefined.
 *
 * @param {string} text
 * @param {BoardOptions} [options]
 * @returns {BoardRow[]}
 */
export function parseBoard(text, { fields = DEFAULT_FIELDS, delimiter = DEFAULT_DELIMITER } = {}) {
  if (!text) return []

  return String(text)
    .split('\n')
    .map((line) => {
      const columns = line.split(delimiter)
      return fields.reduce((row, field, i) => ({ ...row, [field]: (columns[i] ?? '').trim() }), {})
    })
}

/**
 * Rows back to text.
 *
 * Trailing blank rows are dropped so an operator clearing the bottom of the board
 * does not leave empty lines that render as gaps in the graphic. Blank rows in the
 * middle are kept, because those are usually deliberate spacing.
 *
 * @param {BoardRow[]} rows
 * @param {BoardOptions} [options]
 * @returns {string}
 */
export function serializeBoard(rows, { fields = DEFAULT_FIELDS, delimiter = DEFAULT_DELIMITER } = {}) {
  const lines = rows.map((row) => fields.map((field) => row?.[field] ?? '').join(delimiter))

  while (lines.length && !lines.at(-1).replaceAll(delimiter, '').trim()) lines.pop()

  return lines.join('\n')
}

/**
 * Pad or trim to a fixed row count, for a board with a set number of places.
 *
 * @param {BoardRow[]} rows
 * @param {number} count
 * @param {BoardOptions} [options]
 * @returns {BoardRow[]}
 */
export function sizeBoard(rows, count, { fields = DEFAULT_FIELDS } = {}) {
  const empty = () => fields.reduce((row, field) => ({ ...row, [field]: '' }), {})
  const sized = rows.slice(0, count)

  while (sized.length < count) sized.push(empty())

  return sized
}
