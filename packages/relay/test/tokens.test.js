import { describe, expect, it, vi } from 'vitest'

import { createTokens } from '../src/tokens.js'

describe('issuing', () => {
  it('gives each operator their own secret', async () => {
    const tokens = createTokens()
    const dez = await tokens.issue('friday', { name: 'Dez' })
    const sam = await tokens.issue('friday', { name: 'Sam' })

    expect(dez.secret).not.toBe(sam.secret)
    expect(await tokens.check('friday', dez.secret)).toMatchObject({ name: 'Dez' })
  })

  it('keeps rooms apart, so a token for one show is not a token for the next', async () => {
    const tokens = createTokens()
    const dez = await tokens.issue('friday', { name: 'Dez' })

    expect(await tokens.check('saturday', dez.secret)).toBeNull()
  })

  it('never hands secrets back in a listing', async () => {
    // A list is for deciding who to remove. A board rendering one has no use for
    // the secrets, and putting them in the DOM of whoever opened the panel would
    // hand them every operator's credential.
    const tokens = createTokens()

    await tokens.issue('friday', { name: 'Dez' })

    const listed = await tokens.list('friday')

    expect(listed).toHaveLength(1)
    expect(listed[0]).not.toHaveProperty('secret')
    expect(listed[0]).toMatchObject({ name: 'Dez' })
  })
})

describe('revoking', () => {
  it('stops the secret working', async () => {
    const tokens = createTokens()
    const dez = await tokens.issue('friday', { name: 'Dez' })

    expect(await tokens.check('friday', dez.secret)).not.toBeNull()

    await tokens.revoke('friday', dez.id)

    expect(await tokens.check('friday', dez.secret)).toBeNull()
  })

  it('leaves everyone else alone', async () => {
    // The whole reason for per-operator tokens: removing one person must not be an
    // event for the other three.
    const tokens = createTokens()
    const dez = await tokens.issue('friday', { name: 'Dez' })
    const sam = await tokens.issue('friday', { name: 'Sam' })

    await tokens.revoke('friday', dez.id)

    expect(await tokens.check('friday', sam.secret)).toMatchObject({ name: 'Sam' })
  })

  it('is idempotent, and says so', async () => {
    const tokens = createTokens()
    const dez = await tokens.issue('friday', { name: 'Dez' })

    expect(await tokens.revoke('friday', dez.id)).not.toBeNull()
    expect(await tokens.revoke('friday', dez.id)).toBeNull()
    expect(await tokens.revoke('friday', 'never-existed')).toBeNull()
  })

  it('keeps the revoked entry visible rather than forgetting it', async () => {
    const tokens = createTokens()
    const dez = await tokens.issue('friday', { name: 'Dez' })

    await tokens.revoke('friday', dez.id)

    const listed = await tokens.list('friday')

    expect(listed).toHaveLength(1)
    expect(listed[0].revokedAt).toBeTypeOf('number')
  })
})

describe('checking', () => {
  it('refuses nothing at all', async () => {
    const tokens = createTokens()

    await tokens.issue('friday', { name: 'Dez' })

    expect(await tokens.check('friday', '')).toBeNull()
    expect(await tokens.check('friday', undefined)).toBeNull()
    expect(await tokens.check('friday', null)).toBeNull()
  })

  it('does not accept a prefix of a real secret', async () => {
    const tokens = createTokens()
    const dez = await tokens.issue('friday', { name: 'Dez' })

    expect(await tokens.check('friday', dez.secret.slice(0, -1))).toBeNull()
  })

  it('reports whether a room is guarded at all', async () => {
    const tokens = createTokens()

    expect(await tokens.guarded('friday')).toBe(false)

    const dez = await tokens.issue('friday', { name: 'Dez' })

    expect(await tokens.guarded('friday')).toBe(true)

    // Revoking the last one opens the room back up rather than locking everybody
    // out of it -- an empty guest list is not the same as a locked door.
    await tokens.revoke('friday', dez.id)

    expect(await tokens.guarded('friday')).toBe(false)
  })
})

describe('storage', () => {
  it('survives a restart', async () => {
    let saved = null
    const first = createTokens({ save: (plain) => (saved = plain) })
    const dez = await first.issue('friday', { name: 'Dez' })

    const second = createTokens({ load: () => saved })

    expect(await second.check('friday', dez.secret)).toMatchObject({ name: 'Dez' })
  })

  it('carries revocations across one too', async () => {
    // The failure that would matter: a relay restart quietly re-admitting somebody
    // who was removed.
    let saved = null
    const first = createTokens({ save: (plain) => (saved = plain) })
    const dez = await first.issue('friday', { name: 'Dez' })

    await first.revoke('friday', dez.id)

    const second = createTokens({ load: () => saved })

    expect(await second.check('friday', dez.secret)).toBeNull()
  })

  it('starts empty rather than throwing when storage has nothing', async () => {
    const tokens = createTokens({ load: () => null })

    expect(await tokens.list('friday')).toEqual([])
  })

  it('keeps working when a write fails', async () => {
    const noise = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tokens = createTokens({
      save: () => {
        throw new Error('disk full')
      },
    })

    const dez = await tokens.issue('friday', { name: 'Dez' })

    expect(await tokens.check('friday', dez.secret)).not.toBeNull()
    noise.mockRestore()
  })
})
