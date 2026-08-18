import { useEffect, useState } from 'react'

import { usePresent } from '../../hooks/useSync'
import { cx } from '../../toolkits/cx'

/**
 * Who is at this board.
 *
 * Deliberately not an account. There is no sign-in anywhere in this framework and
 * adding one for a name would be absurd -- a production is four people who already
 * know each other, and the only question presence has to answer is "who is in this
 * field with me". A typed name answers it.
 *
 * Kept in localStorage rather than in the document: it belongs to the machine, not
 * to the show, and it should survive a reload without being something another
 * operator can edit.
 *
 * Renders nothing until the store has been read, so the field never flashes empty
 * over a name that was already set.
 */
const KEY = 'single-studio:operator'

const stored = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {}
  } catch {
    return {}
  }
}

export function Operator({ label = 'You are', placeholder = 'Your name', className, ...rest }) {
  const present = usePresent()
  const [name, setName] = useState(null)

  useEffect(() => setName(stored().name ?? ''), [])

  useEffect(() => {
    if (name === null) return

    present({ name: name.trim() || undefined })

    try {
      localStorage.setItem(KEY, JSON.stringify({ name: name.trim() }))
    } catch {
      // A locked-down browser profile is not a reason to lose the field.
    }
  }, [name, present])

  return (
    <label className={cx('ss-operator flex flex-col gap-1', className)} {...rest}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <input
        value={name ?? ''}
        onChange={(event) => setName(event.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500"
      />
    </label>
  )
}
