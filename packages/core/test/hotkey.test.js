import { describe, expect, it } from 'vitest'

import { ariaChord, chordOf, formatChord, isBareKey, isBrowserOwned, isReserved, isTypingKey, matches, problemWith } from '../src/toolkits/hotkey'

/** A KeyboardEvent as far as chordOf is concerned. */
const press = (key, held = {}) => ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...held })

describe('reading a chord off an event', () => {
  it('names a bare key', () => {
    expect(chordOf(press('F2'))).toBe('F2')
  })

  it('upper-cases a letter so shift is carried once, not twice', () => {
    // Otherwise `Shift+s` and `Shift+S` are two chords for one press, and which one
    // got stored would depend on whether the browser reported the shifted character.
    expect(chordOf(press('s', { ctrlKey: true }))).toBe('Ctrl+S')
    expect(chordOf(press('S', { ctrlKey: true }))).toBe('Ctrl+S')
  })

  it('orders modifiers the same way whatever order they were pressed', () => {
    const one = chordOf(press('K', { ctrlKey: true, shiftKey: true, metaKey: true }))
    const two = chordOf(press('K', { metaKey: true, shiftKey: true, ctrlKey: true }))

    expect(one).toBe('Ctrl+Shift+Meta+K')
    expect(one).toBe(two)
  })

  it('gives space a name rather than storing a blank', () => {
    expect(chordOf(press(' ', { ctrlKey: true }))).toBe('Ctrl+Space')
  })

  it('is null while only modifiers are held', () => {
    // Somebody reaching for Ctrl+S is mid-chord. A recorder that accepted this
    // would store `Ctrl` before they got to the S.
    expect(chordOf(press('Control', { ctrlKey: true }))).toBeNull()
    expect(chordOf(press('Shift', { shiftKey: true }))).toBeNull()
    expect(chordOf(press('Meta', { metaKey: true }))).toBeNull()
  })

  it('is null for an event with no key at all', () => {
    expect(chordOf(null)).toBeNull()
    expect(chordOf({})).toBeNull()
  })
})

describe('matching', () => {
  it('matches the chord it was recorded from', () => {
    expect(matches(press('s', { ctrlKey: true }), 'Ctrl+S')).toBe(true)
  })

  it('does not match when a modifier differs', () => {
    expect(matches(press('s', { metaKey: true }), 'Ctrl+S')).toBe(false)
    expect(matches(press('s', { ctrlKey: true, shiftKey: true }), 'Ctrl+S')).toBe(false)
  })

  it('never matches an empty binding', () => {
    // An unbound action must not fire on every keypress that happens to produce a
    // null chord.
    expect(matches(press('Control', { ctrlKey: true }), '')).toBe(false)
    expect(matches(press('S'), '')).toBe(false)
  })
})

describe('showing a chord', () => {
  it('spells modifiers out where they are words', () => {
    expect(formatChord('Ctrl+S')).toBe('Ctrl+S')
  })

  it('is empty for an unbound action rather than reading as a key', () => {
    expect(formatChord('')).toBe('')
  })

  it('uses the aria grammar, which is not the display one', () => {
    // `aria-keyshortcuts` wants Control, not Ctrl, and screen readers read it out.
    expect(ariaChord('Ctrl+S')).toBe('Control+S')
    expect(ariaChord('')).toBeUndefined()
  })
})

describe('what is wrong with a chord', () => {
  it('refuses the ones the board needs for itself', () => {
    expect(isReserved('Escape')).toBe(true)
    expect(problemWith('Escape').level).toBe('blocked')
  })

  it('warns about ones the browser takes first', () => {
    expect(isBrowserOwned('Ctrl+W')).toBe(true)
    expect(problemWith('Ctrl+W').level).toBe('warn')
  })

  it('notes that a plain letter only works outside a field', () => {
    expect(isBareKey('S')).toBe(true)
    expect(problemWith('S').level).toBe('note')
  })

  it('leaves a function key alone, bare though it is', () => {
    // F2 has no modifier but is not a character, so it does not carry the
    // typing caveat.
    expect(isBareKey('F2')).toBe(true)
    expect(problemWith('F2')).toBeNull()
  })

  it('separates "has no modifier" from "is a character somebody types"', () => {
    // These came apart the hard way: treating every modifier-less chord as typing
    // meant a key bound to F8 did nothing while a field had focus, which is exactly
    // when an operator presses save.
    expect(isTypingKey('S')).toBe(true)
    expect(isTypingKey('F8')).toBe(false)
    expect(isTypingKey('Ctrl+S')).toBe(false)
    expect(isTypingKey('ArrowUp')).toBe(false)
    expect(isTypingKey('')).toBe(false)
  })

  it('finds nothing wrong with an ordinary chord', () => {
    expect(problemWith('Ctrl+S')).toBeNull()
    expect(problemWith('')).toBeNull()
  })
})
