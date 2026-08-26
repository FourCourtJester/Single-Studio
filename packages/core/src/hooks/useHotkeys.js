import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

import { useStudio } from '../studio/context'
import { chordOf, isReserved, isTypingKey } from '../toolkits/hotkey'
import { SettingsStore } from '../velcro/settings'

// Which key does what.
//
// Stored in the settings database rather than localStorage, so it travels. A studio
// that is exported and carried to another machine should arrive with the keyboard
// the operator set up, not back on the defaults -- and localStorage is the one
// thing an export of IndexedDB would leave behind.
//
// Still not part of the show: settings are their own database, replicated to
// nobody. One person rebinding save must not move anybody else's.
const SETTING = 'hotkeys'

/** Where these lived before the settings store existed. Read once, then cleared. */
const LEGACY_KEY = 'single-studio:hotkeys'

const isApple = () => typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent)

/**
 * The actions a board can bind, and what they start out as.
 *
 * Ctrl/Cmd+S is the default because it is what the muscle memory already is, and
 * because the board has always answered to it. Discard ships unbound: it throws
 * work away, and a destructive action that arrives already on a key is one somebody
 * finds by accident.
 */
export const ACTIONS = [
  { id: 'save', label: 'Save staged changes', default: () => (isApple() ? 'Meta+S' : 'Ctrl+S') },
  { id: 'discard', label: 'Discard staged changes', default: () => '' },
]

/** The bindings a board has before anybody changes anything. */
export const defaults = () => Object.fromEntries(ACTIONS.map((action) => [action.id, action.default()]))

const merge = (stored) => (stored && typeof stored === 'object' ? { ...defaults(), ...stored } : defaults())

// The reading side has to be synchronous -- useSyncExternalStore asks for a
// snapshot during render and IndexedDB cannot answer in that moment. So the module
// keeps the map in memory, starting at the defaults, and the database catches it up
// once it has read. The window between those two is one paint of the shipped chords,
// which is the right thing to be showing while the answer is unknown.
let bindings = defaults()
let store = null
let loading = null

const listeners = new Set()

const snapshot = () => bindings

const emit = () => {
  for (const listener of listeners) listener()
}

const subscribe = (listener) => {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

/** Anything left in localStorage from before this moved, or null. */
const legacy = () => {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)

    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const forgetLegacy = () => {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Nothing to do about it, and nothing depends on it having worked -- the
    // database is the source of truth from here.
  }
}

/**
 * Point the bindings at a studio's settings, and read them.
 *
 * Idempotent per studio: the board calls this on every render of every component
 * that wants a chord, and only the first does any work.
 *
 * @param {string} studio
 * @returns {Promise<Record<string, string>>}
 */
export function loadBindings(studio) {
  if (store?.name === `${studio}:settings` && loading) return loading

  store = new SettingsStore(studio)

  loading = (async () => {
    const stored = await store.get(SETTING, null)

    if (stored) {
      bindings = merge(stored)
      emit()

      return bindings
    }

    // Nothing in the database. Somebody who set a chord before this moved has it in
    // localStorage, and should not have to set it again -- carry it across once and
    // take it out of the old home so this only happens the once.
    const old = legacy()

    if (old) {
      bindings = merge(old)
      await store.set(SETTING, bindings)
      forgetLegacy()
      emit()
    }

    return bindings
  })()

  return loading
}

/**
 * The bindings as they stand, outside React.
 *
 * @returns {Record<string, string>}
 */
export const currentBindings = () => ({ ...bindings })

/**
 * Bind an action to a chord, or to nothing.
 *
 * Applies immediately and persists in the background. The write can fail -- a
 * private window, a full quota -- and when it does the binding still works for this
 * session; it just will not outlive the tab. That is better than refusing a rebind
 * because of storage, which would leave an operator pressing a key that the dialog
 * says is bound.
 *
 * Rebinding is exclusive: a chord already spoken for is taken off whatever held it,
 * because two actions on one key is not a conflict anybody wants resolved at random.
 *
 * @param {string} id
 * @param {string} chord Canonical chord, or '' to unbind.
 * @returns {Promise<boolean>} Whether it was persisted.
 */
export function bind(id, chord) {
  if (isReserved(chord)) return Promise.resolve(false)

  const next = { ...bindings }

  if (chord) for (const other of Object.keys(next)) if (other !== id && next[other] === chord) next[other] = ''

  next[id] = chord
  bindings = next
  emit()

  return store ? store.set(SETTING, next) : Promise.resolve(false)
}

/**
 * Put every action back to its shipped chord.
 *
 * @returns {Promise<boolean>}
 */
export function resetBindings() {
  bindings = defaults()
  emit()

  return store ? store.remove(SETTING) : Promise.resolve(false)
}

/**
 * Should a key be ignored right now?
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
 * Point the module at this studio's settings and read them, once.
 *
 * In an effect rather than during render: the read is a side effect, and the first
 * paint is meant to use the defaults regardless.
 */
const useLoaded = () => {
  const { studio } = useStudio()
  const id = studio.id ?? studio.name

  useEffect(() => {
    loadBindings(id)
  }, [id])
}

/**
 * The board's bindings, and the ways to change them.
 *
 * @returns {{ bindings: Record<string, string>, bind: typeof bind, reset: typeof resetBindings, chordFor: (id: string) => string }}
 */
export function useHotkeys() {
  const current = useSyncExternalStore(subscribe, snapshot, defaults)

  useLoaded()

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

  useLoaded()

  // Callers pass an object literal -- `{ save, discard }` -- which is a new identity
  // every render. Kept in a ref so the listener is registered once per binding
  // change rather than once per render, while still calling whatever the latest
  // render passed.
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
