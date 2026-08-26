import { beforeEach, describe, expect, it, vi } from 'vitest'

// A localStorage that can be made to fail, because a locked-down profile is one of
// the states this has to survive rather than a hypothetical.
const makeStorage = () => {
  const map = new Map()

  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: vi.fn((key, value) => map.set(key, value)),
    removeItem: (key) => map.delete(key),
    get size() {
      return map.size
    },
  }
}

let storage

const load = async () => {
  vi.resetModules()
  storage = makeStorage()
  vi.stubGlobal('localStorage', storage)

  return import('../src/hooks/useHotkeys')
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('defaults', () => {
  it('binds save and leaves discard alone', async () => {
    const { defaults } = await load()
    const map = defaults()

    // Discard throws work away. A destructive action that ships already on a key is
    // one somebody finds by accident.
    expect(map.save).toMatch(/\+S$/)
    expect(map.discard).toBe('')
  })
})

describe('binding', () => {
  it('stores a chord and reads it back', async () => {
    const { bind, defaults } = await load()

    bind('save', 'F2')

    expect(JSON.parse(storage.getItem('single-studio:hotkeys')).save).toBe('F2')
    expect(defaults().save).not.toBe('F2') // defaults are not mutated by a bind
  })

  it('takes a chord off whatever held it, rather than firing both', async () => {
    const { bind } = await load()

    bind('save', 'F2')
    bind('discard', 'F2')

    const stored = JSON.parse(storage.getItem('single-studio:hotkeys'))

    expect(stored.discard).toBe('F2')
    expect(stored.save).toBe('')
  })

  it('unbinds with an empty chord without disturbing the others', async () => {
    const { bind } = await load()

    bind('discard', 'F4')
    bind('save', '')

    const stored = JSON.parse(storage.getItem('single-studio:hotkeys'))

    expect(stored.save).toBe('')
    expect(stored.discard).toBe('F4')
  })

  it('refuses a chord the board keeps for itself', async () => {
    const { bind } = await load()

    bind('save', 'Escape')

    // Nothing written at all, so the default stands.
    expect(storage.getItem('single-studio:hotkeys')).toBeNull()
  })

  it('survives storage that refuses to write', async () => {
    const { bind, defaults } = await load()

    storage.setItem.mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    // The binding applies for the session; it just will not outlive a reload.
    expect(() => bind('save', 'F5')).not.toThrow()
    expect(defaults().save).not.toBe('F5')
  })
})

describe('reading what was stored', () => {
  it('fills in an action added since the map was written', async () => {
    await load()

    // A map from a build that only knew about save. Reading it literally would
    // leave `discard` absent for everybody who had ever opened the dialog.
    storage.setItem('single-studio:hotkeys', JSON.stringify({ save: 'F8' }))
    vi.resetModules()

    const fresh = await import('../src/hooks/useHotkeys')

    // Read it, rather than binding and inspecting what was written: `bind` spreads
    // the map and then sets its own key, so it supplies the missing action itself
    // and would pass whether or not the read merged.
    const map = fresh.currentBindings()

    expect(map.save).toBe('F8') // the stored choice survived
    expect(map.discard).toBe('') // the action the old map never mentioned is present
  })

  it('falls back to defaults on unreadable storage', async () => {
    const { defaults } = await load()

    storage.setItem('single-studio:hotkeys', '{ not json')
    vi.resetModules()

    const fresh = await import('../src/hooks/useHotkeys')

    expect(fresh.defaults().save).toBe(defaults().save)
  })
})

describe('restoring defaults', () => {
  it('clears what was stored', async () => {
    const { bind, resetBindings } = await load()

    bind('save', 'F9')
    resetBindings()

    expect(storage.getItem('single-studio:hotkeys')).toBeNull()
  })
})
