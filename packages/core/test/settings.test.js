import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { SettingsStore } from '../src/velcro/settings'

let n = 0

/** A store nobody else is using, so one test cannot see another's rows. */
const fresh = () => new SettingsStore(`test-studio-${(n += 1)}`)

describe('naming', () => {
  it('is per studio, so one export carries one studio', () => {
    expect(new SettingsStore('my-show').name).toBe('my-show:settings')
  })

  it('is a different database from the assets one', () => {
    // Settings have no business forcing a version migration of a store full of
    // image blobs, and vice versa.
    expect(new SettingsStore('my-show').name).not.toBe('my-show:assets')
  })
})

describe('reading and writing', () => {
  let store

  beforeEach(() => {
    store = fresh()
  })

  it('round-trips a value', async () => {
    await store.set('hotkeys', { save: 'F8' })

    expect(await store.get('hotkeys')).toEqual({ save: 'F8' })
  })

  it('gives the fallback for something never written', async () => {
    expect(await store.get('nothing-here', 'fallback')).toBe('fallback')
    expect(await store.get('nothing-here')).toBeNull()
  })

  it('distinguishes a stored falsy value from an absent one', async () => {
    // '' is what an unbound action stores, and it has to survive a round trip as
    // itself rather than coming back as the fallback.
    await store.set('empty', '')

    expect(await store.get('empty', 'fallback')).toBe('')
  })

  it('overwrites rather than accumulating', async () => {
    await store.set('hotkeys', { save: 'F8' })
    await store.set('hotkeys', { save: 'F9' })

    expect(await store.get('hotkeys')).toEqual({ save: 'F9' })
  })

  it('keeps settings in their own rows, so two writers do not erase each other', async () => {
    // The reason this is a row per setting rather than one object holding all of
    // them: a read-modify-write of a shared blob loses whichever write lands first.
    await store.set('hotkeys', { save: 'F8' })
    await store.set('theme', 'dark')

    expect(await store.get('hotkeys')).toEqual({ save: 'F8' })
    expect(await store.get('theme')).toBe('dark')
  })

  it('forgets one setting without touching the rest', async () => {
    await store.set('hotkeys', { save: 'F8' })
    await store.set('theme', 'dark')
    await store.remove('hotkeys')

    expect(await store.get('hotkeys')).toBeNull()
    expect(await store.get('theme')).toBe('dark')
  })
})

describe('carrying settings between machines', () => {
  it('hands out everything as a plain object', async () => {
    const store = fresh()

    await store.set('hotkeys', { save: 'F8' })
    await store.set('theme', 'dark')

    expect(await store.all()).toEqual({ hotkeys: { save: 'F8' }, theme: 'dark' })
  })

  it('is empty rather than throwing when nothing has been set', async () => {
    expect(await fresh().all()).toEqual({})
  })

  it('reads back what it wrote out, on another studio', async () => {
    const from = fresh()

    await from.set('hotkeys', { save: 'F8', discard: '' })
    await from.set('theme', 'dark')

    const exported = await from.all()
    const to = fresh()

    await to.replaceAll(exported)

    expect(await to.all()).toEqual(exported)
  })

  it('replaces rather than merges, so an import is not the union of two machines', async () => {
    const store = fresh()

    await store.set('stale', 'from the old machine')
    await store.replaceAll({ hotkeys: { save: 'F8' } })

    expect(await store.get('stale')).toBeNull()
    expect(await store.get('hotkeys')).toEqual({ save: 'F8' })
  })
})

describe('clearing', () => {
  it('drops everything, for "reset this machine"', async () => {
    const store = fresh()

    await store.set('hotkeys', { save: 'F8' })
    await store.clear()

    expect(await store.all()).toEqual({})
  })
})

describe('storage that will not cooperate', () => {
  it('answers with the fallback rather than throwing', async () => {
    const store = new SettingsStore('unopenable')

    // A private window, a profile with storage off, a quota that is full. A board
    // must not refuse to start because a preference would not load.
    store.open = () => Promise.reject(new Error('no storage'))

    expect(await store.get('hotkeys', 'default')).toBe('default')
    expect(await store.all()).toEqual({})
    expect(await store.set('hotkeys', {})).toBe(false)
    expect(await store.remove('hotkeys')).toBe(false)
    expect(await store.clear()).toBe(false)
  })
})
