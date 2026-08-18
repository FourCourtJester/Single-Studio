import { describe, expect, it } from 'vitest'

import { ASSET_SCHEME, assetKeyOf, groupOf, hashBytes, isAssetRef, leafOf, toAssetRef, toKey, uploadKey } from '../src/velcro/assets'

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

  it('keeps slashes, so a key can name a group as well as an image', () => {
    // The whole organisation scheme. A hundred images in one flat list is a
    // scroll; the same hundred under a handful of prefixes is a menu.
    expect(toKey('players/Ada Okafor.jpg')).toBe('players/ada-okafor')
    expect(toKey('Team Logos/Atlético.png')).toBe('team-logos/atletico')
  })

  it('slugs each segment on its own, and strips the extension from the last only', () => {
    expect(toKey('season.2/logo.v2.svg')).toBe('season-2/logo-v2')
  })

  it('drops empty segments rather than leaving a key with a hole in it', () => {
    expect(toKey('/players//ada/')).toBe('players/ada')
    expect(toKey('///')).toBe('')
  })
})

describe('grouping', () => {
  it('splits a key into the group it lives in and the name inside it', () => {
    expect(groupOf('players/ada-okafor')).toBe('players')
    expect(leafOf('players/ada-okafor')).toBe('ada-okafor')
  })

  it('treats an ungrouped key as ungrouped rather than as a group of one', () => {
    expect(groupOf('ada-okafor')).toBe('')
    expect(leafOf('ada-okafor')).toBe('ada-okafor')
  })

  it('groups by everything before the last slash, so nesting survives', () => {
    expect(groupOf('season-2/players/ada')).toBe('season-2/players')
    expect(leafOf('season-2/players/ada')).toBe('ada')
  })
})

describe('uploadKey', () => {
  it('files a loose file under the group that was typed', () => {
    expect(uploadKey('players', 'Ada Okafor.jpg')).toBe('players/ada-okafor')
  })

  it('takes the folder name as the group when none was typed', () => {
    expect(uploadKey('', 'Headshots/Ada Okafor.jpg')).toBe('headshots/ada-okafor')
    expect(uploadKey(undefined, 'Headshots/Ada.jpg')).toBe('headshots/ada')
  })

  it('lets a typed group *rename* the folder rather than nest inside it', () => {
    // The case that made this a function rather than a join. Typing "players" and
    // picking a folder called "Headshots 2024" means "file these under players" --
    // `players/headshots-2024/ada` is nobody's intent, and it buries every image a
    // level deeper than the picker's grouping reads.
    expect(uploadKey('players', 'Headshots 2024/Ada Okafor.jpg')).toBe('players/ada-okafor')
  })

  it('keeps nesting below the folder it renamed', () => {
    expect(uploadKey('players', 'Headshots/goalies/Ada.jpg')).toBe('players/goalies/ada')
  })

  it('leaves a bare filename bare when nothing was typed', () => {
    expect(uploadKey('', 'Ada Okafor.jpg')).toBe('ada-okafor')
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
