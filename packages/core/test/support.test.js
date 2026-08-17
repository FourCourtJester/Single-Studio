import { afterEach, describe, expect, it, vi } from 'vitest'

import { getSupport, resetSupport } from '../src/velcro/support'

// Fakes for the three shapes of browser we care about. The interesting one is
// `StringOnlySharedWorker`: it models a pre-2020 implementation whose second
// argument is only ever a name, which is what makes the real-world failure silent.

class ModuleAwareSharedWorker {
  constructor(url, options) {
    // Reading `.type` is the signal the probe is looking for.
    this.type = options?.type
    this.port = { close: vi.fn() }
  }
}

class StringOnlySharedWorker {
  constructor(url, name) {
    // Never touches `.type` -- coerces the whole object to a name, exactly as an
    // old implementation does.
    this.name = String(name)
    this.port = { close: vi.fn() }
  }
}

class ThrowingSharedWorker {
  constructor(url, options) {
    this.type = options?.type
    throw new Error('blocked by policy')
  }
}

function stubBrowser({ sharedWorker, broadcastChannel = true, indexedDB = true } = {}) {
  const saved = {
    SharedWorker: globalThis.SharedWorker,
    BroadcastChannel: globalThis.BroadcastChannel,
    Blob: globalThis.Blob,
    URL: globalThis.URL,
    indexedDB: globalThis.indexedDB,
  }

  if (sharedWorker) globalThis.SharedWorker = sharedWorker
  else delete globalThis.SharedWorker

  if (broadcastChannel) globalThis.BroadcastChannel = class {}
  else delete globalThis.BroadcastChannel

  if (indexedDB) globalThis.indexedDB = {}
  else delete globalThis.indexedDB

  globalThis.Blob = class {}
  globalThis.URL = { createObjectURL: () => 'blob:probe', revokeObjectURL: () => {} }

  resetSupport()

  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
    resetSupport()
  }
}

let restore = () => {}

afterEach(() => {
  restore()
  restore = () => {}
})

describe('capability check', () => {
  it('passes on a browser that honours the module option', () => {
    restore = stubBrowser({ sharedWorker: ModuleAwareSharedWorker })

    const support = getSupport()

    expect(support.ok).toBe(true)
    expect(support.missing).toEqual([])
    expect(support.persistent).toBe(true)
  })

  it('catches the silent case: SharedWorker exists but ignores { type: "module" }', () => {
    restore = stubBrowser({ sharedWorker: StringOnlySharedWorker })

    const support = getSupport()

    expect(support.ok).toBe(false)
    expect(support.missing).toEqual(['moduleWorker'])
    expect(support.requirements[0].label).toMatch(/ES modules/)
  })

  it('reports a missing SharedWorker without claiming module support is the problem', () => {
    restore = stubBrowser({ sharedWorker: null })

    const support = getSupport()

    expect(support.ok).toBe(false)
    expect(support.missing).toEqual(['sharedWorker'])
    expect(support.missing).not.toContain('moduleWorker')
  })

  it('reports a missing BroadcastChannel', () => {
    restore = stubBrowser({ sharedWorker: ModuleAwareSharedWorker, broadcastChannel: false })

    const support = getSupport()

    expect(support.ok).toBe(false)
    expect(support.missing).toContain('broadcastChannel')
  })

  it('trusts the getter even when constructing the probe throws', () => {
    restore = stubBrowser({ sharedWorker: ThrowingSharedWorker })

    const support = getSupport()

    expect(support.ok).toBe(true)
    expect(support.probeError).toBeInstanceOf(Error)
  })

  it('treats absent IndexedDB as non-fatal, since the host degrades to memory', () => {
    restore = stubBrowser({ sharedWorker: ModuleAwareSharedWorker, indexedDB: false })

    const support = getSupport()

    expect(support.ok).toBe(true)
    expect(support.persistent).toBe(false)
  })

  it('describes every missing capability it reports', () => {
    restore = stubBrowser({ sharedWorker: StringOnlySharedWorker, broadcastChannel: false })

    const support = getSupport()

    expect(support.requirements).toHaveLength(support.missing.length)
    for (const requirement of support.requirements) {
      expect(requirement.label).toBeTruthy()
      expect(requirement.detail).toBeTruthy()
    }
  })

  it('memoizes, so the probe does not build a worker per component', () => {
    const spy = vi.fn(ModuleAwareSharedWorker)

    restore = stubBrowser({
      sharedWorker: class extends ModuleAwareSharedWorker {
        constructor(...args) {
          spy(...args)
          super(...args)
        }
      },
    })

    getSupport()
    getSupport()
    getSupport()

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
