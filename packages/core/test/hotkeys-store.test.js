import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let n = 0
let studio

// The settings module as the hook sees it. `vi.resetModules()` hands out a fresh
// copy of every module, so a class imported at the top of this file would be a
// different object from the one useHotkeys imports -- same database underneath, but
// spying on its prototype would do nothing to the code under test.
let Settings

/** A localStorage that starts empty and can be made to fail. */
const makeStorage = () => {
  const map = new Map()

  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: vi.fn((key, value) => map.set(key, value)),
    removeItem: vi.fn((key) => map.delete(key)),
    has: (key) => map.has(key),
  }
}

let storage

/** The module, freshly imported, pointed at a studio nobody else is using. */
const load = async () => {
  vi.resetModules()
  storage = makeStorage()
  vi.stubGlobal('localStorage', storage)
  studio = `hk-${(n += 1)}`
  Settings = (await import('../src/velcro/settings')).SettingsStore

  return import('../src/hooks/useHotkeys')
}

/** What is actually on disk for this studio. */
const stored = () => new Settings(studio).get('hotkeys')

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
  // Not just tidiness: a test that fails before its own restore would otherwise
  // leave the stub in place and take the rest of the file down with it, which is
  // exactly what happened while writing these.
  vi.restoreAllMocks()
})

describe('defaults', () => {
  it('binds save and leaves discard alone', async () => {
    const { defaults } = await load()

    // Discard throws work away. A destructive action that ships already on a key is
    // one somebody finds by accident.
    expect(defaults().save).toMatch(/\+S$/)
    expect(defaults().discard).toBe('')
  })

  it('is what a board reads before the database has answered', async () => {
    const { currentBindings, defaults } = await load()

    // The read is async and the snapshot is not, so the first paint shows the
    // shipped chords. That is the right thing to show while the answer is unknown.
    expect(currentBindings()).toEqual(defaults())
  })
})

describe('binding', () => {
  it('persists to the settings database, not localStorage', async () => {
    const { bind, loadBindings } = await load()

    await loadBindings(studio)
    await bind('save', 'F2')

    // The point of the whole change: an export of IndexedDB carries this.
    expect(await stored()).toMatchObject({ save: 'F2' })
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('applies immediately, without waiting for the write', async () => {
    const { bind, currentBindings, loadBindings } = await load()

    await loadBindings(studio)

    const writing = bind('save', 'F3')

    expect(currentBindings().save).toBe('F3')
    await writing
  })

  it('comes back on the next load', async () => {
    const { bind, loadBindings } = await load()

    await loadBindings(studio)
    await bind('save', 'F4')

    vi.resetModules()

    const fresh = await import('../src/hooks/useHotkeys')

    await fresh.loadBindings(studio)

    expect(fresh.currentBindings().save).toBe('F4')
  })

  it('takes a chord off whatever held it, rather than firing both', async () => {
    const { bind, currentBindings, loadBindings } = await load()

    await loadBindings(studio)
    await bind('save', 'F5')
    await bind('discard', 'F5')

    expect(currentBindings()).toMatchObject({ discard: 'F5', save: '' })
  })

  it('refuses a chord the board keeps for itself', async () => {
    const { bind, currentBindings, defaults, loadBindings } = await load()

    await loadBindings(studio)
    await bind('save', 'Escape')

    expect(currentBindings().save).toBe(defaults().save)
  })

  it('still applies when the write fails', async () => {
    const { bind, currentBindings, loadBindings } = await load()

    await loadBindings(studio)
    vi.spyOn(Settings.prototype, 'set').mockResolvedValue(false)

    // Refusing a rebind because storage is full would leave an operator pressing a
    // key the dialog says is bound.
    expect(await bind('save', 'F6')).toBe(false)
    expect(currentBindings().save).toBe('F6')
  })
})

describe('an action added after somebody set their keys', () => {
  it('arrives at its default rather than missing', async () => {
    const { loadBindings, currentBindings } = await load()

    // A map written by a build that only knew about save.
    await new Settings(studio).set('hotkeys', { save: 'F7' })
    await loadBindings(studio)

    expect(currentBindings().save).toBe('F7') // their choice survived
    expect(currentBindings().discard).toBe('') // the newer action is present
  })
})

describe('settings written before this moved out of localStorage', () => {
  it('are carried across on first load', async () => {
    const { loadBindings, currentBindings } = await load()

    storage.setItem('single-studio:hotkeys', JSON.stringify({ save: 'F10' }))
    storage.setItem.mockClear()

    await loadBindings(studio)

    expect(currentBindings().save).toBe('F10')
    expect(await stored()).toMatchObject({ save: 'F10' })
  })

  it('are taken out of the old home, so the migration happens once', async () => {
    const { loadBindings } = await load()

    storage.setItem('single-studio:hotkeys', JSON.stringify({ save: 'F11' }))

    await loadBindings(studio)

    expect(storage.has('single-studio:hotkeys')).toBe(false)
  })

  it('do not override what is already in the database', async () => {
    const { loadBindings, currentBindings } = await load()

    // Both present: the database is the newer home and wins. Reading the stale
    // localStorage copy would undo a rebind made after the migration.
    await new Settings(studio).set('hotkeys', { save: 'F12' })
    storage.setItem('single-studio:hotkeys', JSON.stringify({ save: 'F9' }))

    await loadBindings(studio)

    expect(currentBindings().save).toBe('F12')
  })

  it('are not required -- a machine with nothing stored gets the defaults', async () => {
    const { loadBindings, currentBindings, defaults } = await load()

    await loadBindings(studio)

    expect(currentBindings()).toEqual(defaults())
  })
})

describe('restoring defaults', () => {
  it('clears the stored setting', async () => {
    const { bind, loadBindings, resetBindings, currentBindings, defaults } = await load()

    await loadBindings(studio)
    await bind('save', 'F9')
    await resetBindings()

    expect(currentBindings()).toEqual(defaults())
    expect(await stored()).toBeNull()
  })
})
