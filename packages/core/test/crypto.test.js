import { describe, expect, it, vi } from 'vitest'

import { createCipher, isSealed, looksLikeSecret, newSecret, sequence } from '../src/velcro/crypto'

// The claim being tested is narrow and worth stating: a frame that leaves this
// module carries no readable trace of what went in, cannot be altered without the
// change being noticed, and cannot be confused with an unencrypted one.

const text = (value) => new TextEncoder().encode(value)
const read = (value) => new TextDecoder().decode(value)

describe('a room key', () => {
  it('is generated rather than typed', () => {
    // Nobody invents a good passphrase half an hour before doors, and a weak one
    // here is worse than none: it would look like protection and be a dictionary
    // away from nothing.
    expect(looksLikeSecret(newSecret())).toBe(true)
    expect(newSecret()).not.toBe(newSecret())
  })

  it('is url-safe, because its whole job is to ride a link', () => {
    for (let i = 0; i < 50; i += 1) expect(newSecret()).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('refuses anything that is not one', () => {
    expect(() => createCipher('hunter2')).toThrow(/43/)
    expect(looksLikeSecret('')).toBe(false)
    expect(looksLikeSecret(`${newSecret()}x`)).toBe(false)
  })
})

describe('a sealed frame', () => {
  it('comes back as what went in', async () => {
    const cipher = createCipher(newSecret())
    const sealed = await cipher.seal(text('Vanguard 12 - 9 Redline'))

    expect(read(await cipher.open(sealed))).toBe('Vanguard 12 - 9 Redline')
  })

  it('carries no trace of the show it holds', async () => {
    // The whole point, stated as an assertion: what Supabase relays is not the
    // scoreboard. Checked as bytes rather than as a string, because a partial
    // encoding leaking a name would still pass a lazier test.
    const cipher = createCipher(newSecret())
    const secretName = 'Ada Okafor'
    const sealed = await cipher.seal(text(`{"guest":"${secretName}"}`))
    const needle = text(secretName)

    const found = [...sealed].some((_, at) => needle.every((byte, i) => sealed[at + i] === byte))

    expect(found).toBe(false)
  })

  it('is different every time, even for the same bytes', async () => {
    // A fresh nonce per frame. Without it, a repeated score would be a repeated
    // frame, and the traffic alone would give the show away.
    const cipher = createCipher(newSecret())
    const once = await cipher.seal(text('same'))
    const twice = await cipher.seal(text('same'))

    expect(Buffer.from(once).equals(Buffer.from(twice))).toBe(false)
    expect(read(await cipher.open(twice))).toBe('same')
  })

  it('cannot be read with a different key', async () => {
    const sealed = await createCipher(newSecret()).seal(text('Vanguard'))

    await expect(createCipher(newSecret()).open(sealed)).rejects.toThrow()
  })

  it('cannot be altered without the change being noticed', async () => {
    // AES-GCM authenticates as well as encrypts, which is what stops somebody who
    // guessed the room name from writing to the show. Integrity is doing as much
    // work here as secrecy.
    const cipher = createCipher(newSecret())
    const sealed = await cipher.seal(text('Vanguard 12'))

    sealed[sealed.length - 3] ^= 0x01

    await expect(cipher.open(sealed)).rejects.toThrow()
  })

  it('is told apart from an unencrypted one by its first byte', async () => {
    // A plaintext mesh frame opens with a lib0 varuint of 0 or 1 -- the sync and
    // awareness types. Refusing those is what makes this encryption rather than the
    // appearance of it: a peer without the key must not be able to talk its way in.
    const cipher = createCipher(newSecret())

    expect(isSealed(await cipher.seal(text('x')))).toBe(true)
    expect(isSealed(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]))).toBe(false)
    expect(isSealed(Uint8Array.from([1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]))).toBe(false)

    await expect(cipher.open(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]))).rejects.toThrow(/unsealed/)
  })
})

describe('ordering', () => {
  it('puts bytes on the wire in the order they were made', async () => {
    // Sealing is asynchronous and sending is not. Without a chain a burst of edits
    // reaches the wire in whatever order the crypto finished in, and an update
    // whose dependencies have not arrived sits parked -- which on air is a value
    // that is not stale but missing.
    const done = []
    const run = sequence()
    const slow = (n) => new Promise((resolve) => setTimeout(resolve, n === 0 ? 20 : 0))

    for (const n of [0, 1, 2, 3]) run(async () => (await slow(n), done.push(n)))

    await run(async () => {})

    expect(done).toEqual([0, 1, 2, 3])
  })

  it('keeps running after one piece of work fails', async () => {
    const noise = vi.spyOn(console, 'error').mockImplementation(() => {})
    const done = []
    const run = sequence()

    run(async () => {
      throw new Error('nope')
    })
    run(async () => done.push('after'))

    await run(async () => {})

    expect(done).toEqual(['after'])

    noise.mockRestore()
  })
})
