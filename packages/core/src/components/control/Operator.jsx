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
 * A machine that has never been named gets one, rather than showing up as a blank.
 * Presence exists to answer "who is in this field with me", and an unnamed peer
 * answers it with silence -- the field goes on saying somebody is editing it while
 * refusing to say who, which is worse than a made-up name and no better than no
 * presence at all. The generated one is an ordinary starting value: it is written
 * into the field, it can be typed over, and it survives a reload like any other.
 */
const KEY = 'single-studio:operator'

/**
 * Two short lists, because a name has to be sayable.
 *
 * "Operator 7" is unambiguous and useless -- nobody says it out loud, and on a
 * headset the point of a name is that somebody can. Sixteen by sixteen is plenty
 * for a production of four, and small enough to sit in a file without apology.
 */
const COLOURS = ['Amber', 'Cobalt', 'Crimson', 'Emerald', 'Ivory', 'Jade', 'Onyx', 'Rust', 'Sable', 'Saffron', 'Scarlet', 'Silver', 'Slate', 'Teal', 'Umber', 'Violet']
const CREATURES = ['Albatross', 'Badger', 'Falcon', 'Heron', 'Ibex', 'Jackal', 'Kestrel', 'Lynx', 'Magpie', 'Osprey', 'Otter', 'Panther', 'Raven', 'Stoat', 'Vulture', 'Wolf']

const pick = (list) => list[Math.floor(Math.random() * list.length)]

export const suggestName = () => `${pick(COLOURS)} ${pick(CREATURES)}`

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

  useEffect(() => {
    const held = stored().name

    // Only when nothing has ever been set. Somebody who cleared the field on
    // purpose has said something, and having a name reappear under the cursor
    // would be the board arguing with them.
    setName(held ?? suggestName())
  }, [])

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
