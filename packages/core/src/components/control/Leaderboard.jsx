import { useMemo, useState } from 'react'

import { useDraftValue } from '../../studio/DraftProvider'
import { cx } from '../../toolkits/cx'
import { DEFAULT_DELIMITER, DEFAULT_FIELDS, parseBoard, serializeBoard, sizeBoard } from '../../toolkits/board'
import { Field } from './Field'

/**
 * A results board, editable two ways.
 *
 * **Paste view** is a textarea holding the raw delimited text. This is the one that
 * matters in practice: an operator copies a block of standings out of a spreadsheet
 * or a bracket and drops it in whole.
 *
 * **Table view** is one input per cell, for fixing a single name without
 * re-pasting everything.
 *
 * Both edit the same single path. The board is one delimited string rather than one
 * path per cell, which keeps a paste a single atomic write instead of twenty racing
 * ones — and means the source component can render the whole board from one
 * subscription.
 */
export function Leaderboard({
  name,
  label = 'Leaderboard',
  fields = DEFAULT_FIELDS,
  delimiter = DEFAULT_DELIMITER,
  rows,
  namespace = 'variables',
  className,
  ...rest
}) {
  const path = `${namespace}.${name}`
  // Staged like any other text control: a half-pasted board must not reach air.
  const { value, dirty, onChange } = useDraftValue(path)
  const [tabular, setTabular] = useState(false)

  const entries = useMemo(() => {
    const parsed = parseBoard(value, { fields, delimiter })

    // A fixed-size board always shows every place, even the empty ones, so an
    // operator can fill in fourth without first creating a fourth row.
    return rows ? sizeBoard(parsed, rows, { fields }) : parsed
  }, [value, fields, delimiter, rows])

  const editCell = (index, field, next) => {
    const updated = entries.map((row, i) => (i === index ? { ...row, [field]: next } : row))

    onChange(serializeBoard(updated, { fields, delimiter }))
  }

  const addRow = () => {
    const blank = fields.reduce((row, field) => ({ ...row, [field]: '' }), {})

    onChange(serializeBoard([...entries, blank], { fields, delimiter }))
  }

  return (
    <section className={cx('ss-leaderboard flex w-full flex-col gap-3', className)} {...rest}>
      <header className="flex items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-400">
          {label}
          {dirty ? <span aria-label="unsaved" title="Unsaved" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
        </h3>
        <button
          type="button"
          onClick={() => setTabular((previous) => !previous)}
          title={tabular ? 'Switch to paste view' : 'Switch to table view'}
          className="ml-auto rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-slate-500"
        >
          {tabular ? 'Paste' : 'Table'}
        </button>
      </header>

      {tabular ? (
        <div className="flex flex-col gap-1">
          <div className="grid gap-x-2" style={{ gridTemplateColumns: `1.5rem repeat(${fields.length}, minmax(0, 1fr))` }}>
            <span />
            {fields.map((field) => (
              <span key={field} className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {field}
              </span>
            ))}
          </div>
          {entries.map((row, index) => (
            // Index as key is correct here: rows are positional places, not
            // identities, so row 3 stays row 3 no matter what is typed into it.
            <div key={index} className="grid items-center gap-x-2" style={{ gridTemplateColumns: `1.5rem repeat(${fields.length}, minmax(0, 1fr))` }}>
              {/* Tight on purpose. The place number is one or two digits doing one
                  job, and a wide column for it pushes every name away from the edge
                  it should be reading against. */}
              <span className="text-right text-xs tabular-nums leading-none text-slate-500">{index + 1}</span>
              {fields.map((field) => (
                <input
                  key={field}
                  value={row[field] ?? ''}
                  onChange={(event) => editCell(index, field, event.target.value)}
                  aria-label={`Place ${index + 1} ${field}`}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none transition-colors focus:border-sky-500"
                />
              ))}
            </div>
          ))}
          {rows ? null : (
            <button
              type="button"
              onClick={addRow}
              className="self-start rounded-md border border-dashed border-slate-700 px-2 py-1 text-xs text-slate-400 transition-colors hover:border-slate-500"
            >
              Add row
            </button>
          )}
        </div>
      ) : (
        <>
          <Field name={name} namespace={namespace} label={null} as="textarea" rows={Math.max(3, entries.length || 3)} className="w-full" />
          <p className="text-xs text-slate-500">
            One row per line, {delimiter === '\t' ? 'tab' : `"${delimiter}"`}-separated: {fields.join(` ${delimiter === '\t' ? '⇥' : delimiter} `)}
          </p>
        </>
      )}
    </section>
  )
}
