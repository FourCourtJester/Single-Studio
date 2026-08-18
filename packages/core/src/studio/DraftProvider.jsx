import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { useVelcroMutate } from '../hooks/useVelcroMutate'
import { useVelcroValue } from '../hooks/useVelcroValue'
import { usePresent } from '../hooks/useSync'
import * as Draft from './draft'

const DraftContext = createContext(null)

/**
 * Holds staged edits for the whole control surface.
 *
 * Mounted inside StudioProvider, so any control can stage regardless of where a
 * studio renders it. The save affordance itself lives on the control page.
 *
 * The ref is the authority and the state is only there to re-render. An earlier cut
 * had it the other way round -- state as truth, ref mirrored during render -- and
 * lost an edit: Ctrl+S in the same tick as the last keystroke ran before React had
 * re-rendered, so save() read a draft that did not yet contain it and committed
 * nothing. Writing the ref inside the update makes every read see the newest draft
 * regardless of render timing.
 */
export function DraftProvider({ children }) {
  const pending = useRef(Draft.EMPTY)
  const [draft, setDraft] = useState(Draft.EMPTY)
  const mutate = useVelcroMutate()

  const apply = useCallback((next) => {
    if (next === pending.current) return

    pending.current = next
    setDraft(next)
  }, [])

  /**
   * Tell the room which paths this board has open.
   *
   * The staged-edit model does all the work here. An edit is already local until
   * saved, and a dirty field's staged value already wins over the store, so
   * warning two operators that they are in the same field costs one list of path
   * names -- no locking scheme, and nothing that can wedge a board mid-show if
   * somebody closes their laptop with a field open.
   */
  const present = usePresent()
  const staged = Draft.paths(draft).join('\u0000')

  useEffect(() => {
    present({ editing: staged ? staged.split('\u0000') : [] })
  }, [present, staged])

  const api = useMemo(
    () => ({
      draft,
      stage: (path, value, stored) => apply(Draft.stage(pending.current, path, value, stored)),
      revert: (path) => apply(path ? Draft.unstage(pending.current, path) : Draft.EMPTY),
      save: () => {
        const staged = pending.current

        if (!Draft.isDirty(staged)) return false

        // One mutation for every staged path: a single transaction, so the whole
        // board changes on air together.
        mutate('set', Draft.payload(staged))
        apply(Draft.EMPTY)

        return true
      },
    }),
    [apply, draft, mutate],
  )

  return <DraftContext.Provider value={api}>{children}</DraftContext.Provider>
}

export function useDraft() {
  const context = useContext(DraftContext)

  if (!context) throw new Error('Missing <DraftProvider>. Render your studio with StudioApp, which provides one.')

  return context
}

/** Count of staged paths, for a save button. */
export function useDraftCount() {
  return Draft.count(useDraft().draft)
}

/**
 * Bind one path to the draft.
 *
 * Returns the value to display -- staged if there is one, stored otherwise -- so a
 * remote change never yanks text out from under someone who is mid-edit, and a
 * clean field still follows the store.
 */
export function useDraftValue(path, fallback = '') {
  const stored = useVelcroValue(path, fallback)
  const { draft, stage, revert, save } = useDraft()

  const dirty = Draft.has(draft, path)
  const value = Draft.resolve(draft, path, stored)

  const onChange = useCallback((next) => stage(path, next, stored), [path, stage, stored])
  const onRevert = useCallback(() => revert(path), [path, revert])

  /** Enter saves, Escape abandons this field's edit. */
  const onKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        save()
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onRevert()
      }
    },
    [onRevert, save],
  )

  return { value, stored, dirty, onChange, onKeyDown, revert: onRevert, save }
}
