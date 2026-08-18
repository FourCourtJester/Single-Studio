import { describe, expect, it } from 'vitest'

import { ASSET_SCHEME, assetIdOf, hashBytes, isAssetRef, toAssetRef } from '../src/velcro/assets'

const bytes = (text) => new TextEncoder().encode(text).buffer

describe('asset references', () => {
  it('round-trips an id through a reference', () => {
    const id = 'a'.repeat(64)

    expect(toAssetRef(id)).toBe(`${ASSET_SCHEME}${id}`)
    expect(assetIdOf(toAssetRef(id))).toBe(id)
  })

  it('recognises only its own scheme', () => {
    expect(isAssetRef('asset:abc')).toBe(true)
    expect(isAssetRef('https://example.com/a.png')).toBe(false)
    expect(isAssetRef('/logos/team.svg')).toBe(false)
    expect(isAssetRef(undefined)).toBe(false)
  })

  it('returns null for a value that is not a reference, so callers can pass anything through', () => {
    expect(assetIdOf('https://example.com/a.png')).toBeNull()
    expect(assetIdOf('')).toBeNull()
  })
})

describe('content addressing', () => {
  it('hashes to a 64-character hex digest', async () => {
    const id = await hashBytes(bytes('hello'))

    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gives identical bytes an identical id, so re-uploading is a no-op', async () => {
    expect(await hashBytes(bytes('same'))).toBe(await hashBytes(bytes('same')))
  })

  it('gives different bytes different ids', async () => {
    expect(await hashBytes(bytes('one'))).not.toBe(await hashBytes(bytes('two')))
  })

  it('matches the known SHA-256 of "abc"', async () => {
    // Pinned against a published vector rather than against itself, so a change of
    // algorithm cannot silently pass.
    expect(await hashBytes(bytes('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
