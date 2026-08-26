import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

import { chordOf, isReserved, isTypingKey } from '../toolkits/hotkey'

// Which key does what, on this machine.
//
// Local, not part of the show. An operator's choice of key belongs to the keyboard
// in front of them the same way their name does -- replicating it would mean one
// person's rebind silently moved everybody else's save, which is the sort of
// surprise a live show does not need. Same `single-studio:` prefix as the operator
// name and the relay config, so "Reset this machine" clears it with everything else.
const KEY = 'single-studio:hotkeys'

const isApple = () => typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent)

/**
 * The actions a board can bind, and what they start out as.
 *
 * Ctrl/Cmd+S is the default because it is what the muscle memory already is, and
 * because the board has always answered to it. Discard ships unbound: it throws
 * work away, and a destructive action that arrives already on a key is one somebody
 * finds by accident.
 *
 * Both modifiers on the save default rather than one per platform -- Mac keyboards
 * have Ctrl too, and a Mac operator who reaches for it should not find nothing.
 */
export const ACTIONS = [
  { id: 'save', label: 'Save staged changes', default: () => (isApple() ? 'Meta+S' : 'Ctrl+S') },
  { id: 'discard', label: 'Discard staged changes', default: () => '' },
]

/** The bindings a board has before anybody changes anything. */
export const defaults = () => Object.fromEntries(ACTIONS.map((action) => [action.id, action.default()]))

const read = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null')

    // Merged over the defaults rather than used as-is: a stored map written before
    // an action existed is missing that key, and a board that read it literally
    // would leave the new action unbound for everybody who had ever opened the
    // dialog.
    return stored && typeof stored === 'object' ? { ...defaults(), ...stored } : defaults()
  } catch {
    return defaults()
  }
}

// One subscription list for the whole board. The dialog rebinds and the SaveButton
// relabels itself, and both are reading the same map -- so the store lives at module
// scope and every hook is a view onto it, rather than each component keeping a copy
// that the others cannot invalidate.
let bindings = null
const listeners = new Set()

const snapshot = () => {
  bindings ??= read()

  return bindings
}

const emit = () => {
  for (const listener of listeners) listener()
}

const subscribe = (listener) => {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

/**
 * The bindings as they stand, outside React.
 *
 * The hook is the usual way in, but a studio's own code -- a service, a keydown
 * handler of its own -- has no component to hang one off.
 *
 * @returns {Record<string, string>}
 */
export const currentBindings = () => ({ ...snapshot() })

/**
 * Bind an action to a chord, or to nothing.
 *
 * Rebinding is exclusive: a chord already spoken for is taken off whatever held it,
 * because two actions on one key is not a conflict anybody wants resolved at
 * random -- and the alternative, refusing the rebind, leaves an operator hunting
 * for which existing binding is in the way.
 *
 * @param {string} id
 * @param {string} chord Canonical chord, or '' to unbind.
 */
export function bind(id, chord) {
  if (isReserved(chord)) return

  const next = { ...snapshot() }

  if (chord) for (const [other] of Object.entries(next)) if (other !== id && next[other] === chord) next[other] = ''

  next[id] = chord
  bindings = next

  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // A locked-down profile can refuse to store. The binding still applies for this
    // session; it just will not survive a reload, which is the same bargain the
    // rest of the board's local state makes.
  }

  emit()
}

/** Put every action back to its shipped chord. */
export function resetBindings() {
  bindings = defaults()

  try {
    localStorage.removeItem(KEY)
  } catch {
    // As above.
  }

  emit()
}

/**
 * Should a bare key be ignored right now?
 *
 * A chord with a modifier fires anywhere -- Ctrl+S while typing in a field is the
 * whole point of it. So does a function key, which puts nothing in a field. Only a
 * chord that *is* a character has to stand aside, or that letter could never be
 * typed.
 */
const typingInto = (target) => {
  if (!target) return false

  const tag = target.tagName

  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true
}

/**
 * The board's bindings, and the ways to change them.
 *
 * @returns {{ bindings: Record<string, string>, bind: typeof bind, reset: typeof resetBindings, chordFor: (id: string) => string }}
 */
export function useHotkeys() {
  const current = useSyncExternalStore(subscribe, snapshot, defaults)

  const chordFor = useCallback((id) => current[id] ?? '', [current])

  return useMemo(() => ({ bindings: current, bind, reset: resetBindings, chordFor }), [current, chordFor])
}

/**
 * Run `handlers[id]` when the chord bound to `id` is pressed.
 *
 * Registered wherever the action is meaningful rather than globally -- a graphic
 * page has nothing to save and should not be swallowing the browser's Ctrl+S.
 *
 * @param {Record<string, () => void>} handlers Keyed by action id.
 */
export function useHotkeyHandlers(handlers) {
  const current = useSyncExternalStore(subscribe, snapshot, defaults)

  // Callers pass an object literal -- `{ save, discard }` -- which is a new
  // identity every render. Kept in a ref so the listener is registered once per
  // binding change rather than once per render, while still calling whatever the
  // latest render passed.
  const latest = useRef(handlers)

  latest.current = handlers

  useEffect(() => {
    const onKeyDown = (event) => {
      const chord = chordOf(event)

      if (!chord) return

      for (const [id, handler] of Object.entries(latest.current)) {
        if (current[id] !== chord || typeof handler !== 'function') continue
        if (isTypingKey(chord) && typingInto(event.target)) continue

        // Before the handler, not after: a handler that throws should still have
        // stopped the browser opening its own save dialog over the board.
        event.preventDefault()
        handler()

        return
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [current])
}
