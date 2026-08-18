import { describe, expect, it } from 'vitest'

import { ASSET_SCHEME, assetKeyOf, hashBytes, isAssetRef, toAssetRef, toKey } from '../src/velcro/assets'

const bytes = (text) => new TextEncoder().encode(text).buffer

describe('asset references', () => {
  it('round-trips a key through a reference', () => {
    expect(toAssetRef('ada-okafor')).toBe(`${ASSET_SCHEME}ada-okafor`)
    expect(assetKeyOf(toAssetRef('ada-okafor'))).toBe('ada-okafor')
  })

  it('recognises only its own scheme, so a raw URL passes through untouched', () => {
    expect(isAssetRef('asset:ada-okafor')).toBe(true)
    expect(isAssetRef('https://example.com/a.png')).toBe(false)
    expect(isAssetRef('/logos/team.svg')).toBe(false)
    expect(isAssetRef(undefined)).toBe(false)
  })

  it('returns null for anything that is not a reference', () => {
    expect(assetKeyOf('https://example.com/a.png')).toBeNull()
    expect(assetKeyOf('')).toBeNull()
  })
})

describe('keys', () => {
  it('slugifies a filename into something typeable', () => {
    expect(toKey('Ada Okafor.jpg')).toBe('ada-okafor')
    expect(toKey('sponsor_ACME v2.PNG')).toBe('sponsor-acme-v2')
  })

  it('strips only the extension, not every dot', () => {
    expect(toKey('logo.v2.svg')).toBe('logo-v2')
  })

  it('reduces accents so a key stays ASCII', () => {
    expect(toKey('Atlético.png')).toBe('atletico')
  })

  it('survives input with nothing usable in it', () => {
    expect(toKey('!!!.png')).toBe('')
    expect(toKey(undefined)).toBe('')
  })
})

describe('content addressing', () => {
  it('hashes to a 64-character hex digest', async () => {
    expect(await hashBytes(bytes('hello'))).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gives identical bytes an identical hash, so one file stores once', async () => {
    expect(await hashBytes(bytes('same'))).toBe(await hashBytes(bytes('same')))
  })

  it('gives different bytes different hashes', async () => {
    expect(await hashBytes(bytes('one'))).not.toBe(await hashBytes(bytes('two')))
  })

  it('matches the published SHA-256 of "abc"', async () => {
    // Pinned against a known vector rather than against itself, so a change of
    // algorithm cannot quietly pass.
    expect(await hashBytes(bytes('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
