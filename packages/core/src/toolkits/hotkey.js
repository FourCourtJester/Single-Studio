// Keyboard chords: reading one off an event, writing one down, and comparing two.
//
// Pure string work, deliberately. The manager that stores bindings and the dialog
// that records them both need the same answer to "what did they just press", and a
// chord that round-trips through a string is one that can live in localStorage and
// be compared without a parser on either side.
//
// The canonical form is modifiers in a fixed order, then the key, joined by `+`:
//
//   Ctrl+S        Meta+Shift+K        F2        Alt+ArrowUp
//
// Fixed order matters more than it looks. `Shift+Ctrl+S` and `Ctrl+Shift+S` are the
// same chord to an operator, and storing whichever order they happened to press the
// modifiers in would make two bindings that never compare equal.

const ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta']

const isMac = () => typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent)

/**
 * Keys that are a modifier and nothing else.
 *
 * Held on their own they are not a chord, they are the first half of one -- a
 * recorder that accepted them would store `Ctrl` the instant somebody reached for
 * `Ctrl+S`.
 */
const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'OS'])

/**
 * Chords the board needs for itself.
 *
 * Escape closes dialogs and abandons an edit in progress; Tab moves between fields.
 * Binding either would take away something an operator uses constantly to get one
 * they chose, which is a bad trade even by the standard of "their risk, not ours".
 */
const RESERVED = new Set(['Escape', 'Tab', 'Shift+Tab'])

/**
 * Chords the browser keeps, whatever the page says.
 *
 * `preventDefault` does not reach these -- the browser handles them above the
 * document -- so a binding on one would silently never fire. Warned about at the
 * moment somebody records it rather than discovered mid-show.
 *
 * Not exhaustive, and cannot be: the set differs by browser, platform and OS
 * settings. It covers the ones people actually reach for.
 */
const BROWSER_OWNED = new Set([
  'Ctrl+W',
  'Meta+W',
  'Ctrl+T',
  'Meta+T',
  'Ctrl+N',
  'Meta+N',
  'Ctrl+Q',
  'Meta+Q',
  'Ctrl+Tab',
  'Ctrl+Shift+Tab',
  'Meta+Alt+I',
  'Ctrl+Shift+I',
  'F11',
  'F12',
])

/**
 * Normalise the key itself.
 *
 * Letters upper-case so `s` and `S` are one key -- Shift is carried as a modifier,
 * not baked into the letter, or `Shift+s` and `S` would be different chords for the
 * same press. Space gets a name because ' ' is unreadable in a stored binding and
 * invisible in a dialog.
 */
const normaliseKey = (key) => {
  if (key === ' ' || key === 'Spacebar') return 'Space'
  if (key.length === 1) return key.toUpperCase()

  return key
}

/**
 * The chord for a keyboard event, or null if it is not one yet.
 *
 * @param {KeyboardEvent} event
 * @returns {string | null} Canonical chord, or null while only modifiers are held.
 */
export function chordOf(event) {
  if (!event?.key || MODIFIER_KEYS.has(event.key)) return null

  const down = { Ctrl: event.ctrlKey, Alt: event.altKey, Shift: event.shiftKey, Meta: event.metaKey }
  const held = ORDER.filter((name) => down[name])

  return [...held, normaliseKey(event.key)].join('+')
}

/**
 * Does this event match a stored chord?
 *
 * @param {KeyboardEvent} event
 * @param {string} chord
 * @returns {boolean}
 */
export const matches = (event, chord) => Boolean(chord) && chordOf(event) === chord

/**
 * A chord as an operator should read it.
 *
 * Mac keyboards print their modifiers as symbols and every Mac application shows
 * them that way, so a board that spelled out "Meta" would be the only thing on the
 * machine that did.
 *
 * @param {string} chord
 * @returns {string}
 */
export function formatChord(chord) {
  if (!chord) return ''

  const mac = isMac()
  const symbols = { Ctrl: mac ? '⌃' : 'Ctrl', Alt: mac ? '⌥' : 'Alt', Shift: mac ? '⇧' : 'Shift', Meta: mac ? '⌘' : 'Win' }
  const parts = chord.split('+').map((part) => symbols[part] ?? part)

  return mac ? parts.join('') : parts.join('+')
}

/**
 * The value `aria-keyshortcuts` wants, which is not the display form.
 *
 * That attribute has its own grammar -- `Control+S`, not `Ctrl+S` or `⌘S` -- and
 * screen readers announce it verbatim.
 *
 * @param {string} chord
 * @returns {string}
 */
export const ariaChord = (chord) => (chord ? chord.replace('Ctrl', 'Control') : undefined)

/**
 * Is this chord one the board keeps for itself?
 *
 * @param {string} chord
 * @returns {boolean}
 */
export const isReserved = (chord) => RESERVED.has(chord)

/**
 * Would the browser take this one before the page saw it?
 *
 * @param {string} chord
 * @returns {boolean}
 */
export const isBrowserOwned = (chord) => BROWSER_OWNED.has(chord)

/**
 * A chord with no modifier is a single key, and a single key is a character
 * somebody types.
 *
 * Bindable -- F-keys live here and are a perfectly good choice -- but a plain letter
 * needs saying out loud, because it only works while no field has focus and that is
 * not obvious from the dialog.
 *
 * @param {string} chord
 * @returns {boolean}
 */
export const isBareKey = (chord) => Boolean(chord) && !chord.includes('+')

/**
 * Would pressing this chord be indistinguishable from typing?
 *
 * The narrower question than `isBareKey`, and the one that actually matters when
 * deciding whether to ignore a key because a field has focus. `F8` has no modifier
 * but puts nothing in a field, so a board that skipped it while typing would leave
 * the binding dead in the one place an operator uses it -- straight after editing a
 * name. A bare `S` genuinely is the letter.
 *
 * @param {string} chord
 * @returns {boolean}
 */
export const isTypingKey = (chord) => isBareKey(chord) && chord.length === 1

/**
 * What is wrong with this chord, if anything.
 *
 * Three levels rather than a boolean: something the board will not give up,
 * something the browser will not give up, and something that works but has a catch
 * worth knowing. Only the first is refused -- the rest are the operator's call.
 *
 * @param {string} chord
 * @returns {{ level: 'blocked' | 'warn' | 'note', message: string } | null}
 */
export function problemWith(chord) {
  if (!chord) return null

  if (isReserved(chord)) {
    return { level: 'blocked', message: `${formatChord(chord)} is used by the board itself and cannot be bound.` }
  }

  if (isBrowserOwned(chord)) {
    return { level: 'warn', message: `The browser handles ${formatChord(chord)} before this page sees it, so this binding will not fire.` }
  }

  if (isTypingKey(chord)) {
    return { level: 'note', message: `${formatChord(chord)} only works while no text field has focus, since otherwise you would be typing it.` }
  }

  return null
}
