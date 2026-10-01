import { describe, expect, it, vi } from 'vitest'

import { pollToken, refreshTokens, requestCode, revoke, whoIs } from '../src/auth'

// Signing in, one step at a time, against a fake Twitch. The wording of Twitch's
// answers is taken from its device-flow documentation; the real round trip was
// checked from a browser, and that check is what these stand in for.

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const fields = (init) => Object.fromEntries(new URLSearchParams(init.body))

describe('asking for a code', () => {
  it('names the app and every permission the chosen events need', async () => {
    const fetch = vi.fn(async () =>
      reply(200, { device_code: 'dev', user_code: 'WDJB-MJHT', verification_uri: 'https://www.twitch.tv/activate', interval: 5, expires_in: 1800 }),
    )

    const code = await requestCode({ clientId: 'cid', scopes: ['user:read:chat', 'bits:read'], fetch, now: 1_000 })

    expect(fetch.mock.calls[0][0]).toBe('https://id.twitch.tv/oauth2/device')
    expect(fields(fetch.mock.calls[0][1])).toEqual({ client_id: 'cid', scopes: 'user:read:chat bits:read' })
    expect(code).toEqual({ deviceCode: 'dev', userCode: 'WDJB-MJHT', uri: 'https://www.twitch.tv/activate', interval: 5, expiresAt: 1_801_000 })
  })

  it('says why Twitch would not start one', async () => {
    const fetch = vi.fn(async () => reply(400, { status: 400, message: 'invalid client' }))

    await expect(requestCode({ clientId: 'bad', scopes: [], fetch })).rejects.toThrow(/would not start a sign-in: invalid client/)
  })
})

describe('waiting for the operator to approve it', () => {
  const ask = (status, body) =>
    pollToken({ clientId: 'cid', scopes: ['user:read:chat'], deviceCode: 'dev', fetch: vi.fn(async () => reply(status, body)), now: 0 })

  it('hears "not yet" as waiting, not as failing', async () => {
    expect(await ask(400, { status: 400, message: 'authorization_pending' })).toEqual({ pending: true })
  })

  it('hears "slow down" as waiting longer', async () => {
    expect(await ask(400, { status: 400, message: 'slow_down' })).toEqual({ slowDown: true })
  })

  it('takes the tokens when approved', async () => {
    expect(await ask(200, { access_token: 'tok', refresh_token: 'ref', expires_in: 14_000 })).toEqual({ token: 'tok', refresh: 'ref', expiresAt: 14_000_000 })
  })

  it('stops, with Twitch’s reason, on anything else', async () => {
    await expect(ask(400, { status: 400, message: 'authorization_denied' })).rejects.toThrow(/did not complete: authorization_denied/)
  })

  it('asks with the device grant, so Twitch knows which code is meant', async () => {
    const fetch = vi.fn(async () => reply(400, { message: 'authorization_pending' }))

    await pollToken({ clientId: 'cid', scopes: ['a', 'b'], deviceCode: 'dev', fetch })

    expect(fields(fetch.mock.calls[0][1])).toEqual({
      client_id: 'cid',
      scopes: 'a b',
      device_code: 'dev',
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })
  })
})

describe('staying signed in', () => {
  it('swaps a refresh token for a new pair, with no secret', async () => {
    const fetch = vi.fn(async () => reply(200, { access_token: 'new', refresh_token: 'next', expires_in: 100 }))

    expect(await refreshTokens({ clientId: 'cid', refresh: 'old', fetch, now: 0 })).toEqual({ token: 'new', refresh: 'next', expiresAt: 100_000 })
    expect(fields(fetch.mock.calls[0][1])).toEqual({ client_id: 'cid', grant_type: 'refresh_token', refresh_token: 'old' })
  })

  it('marks a refused refresh as signed out, because the answer is a button and not a retry', async () => {
    const fetch = vi.fn(async () => reply(400, { status: 400, message: 'Invalid refresh token' }))
    const failure = await refreshTokens({ clientId: 'cid', refresh: 'old', fetch }).catch((error) => error)

    expect(failure.signedOut).toBe(true)
    expect(failure.message).toMatch(/signed this machine out.*Sign in again/)
  })

  it('does not mark a server fault as signed out', async () => {
    const fetch = vi.fn(async () => reply(503, {}))
    const failure = await refreshTokens({ clientId: 'cid', refresh: 'old', fetch }).catch((error) => error)

    expect(failure.signedOut).toBe(false)
  })
})

describe('who signed in', () => {
  it('reads the user id off the token, so nobody is asked for a number they do not know', async () => {
    const fetch = vi.fn(async () => reply(200, { user_id: 13821412, login: 'fourcourtjester' }))

    expect(await whoIs({ token: 'tok', fetch })).toEqual({ userId: '13821412', login: 'fourcourtjester' })
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('OAuth tok')
  })

  it('answers null for a token Twitch no longer accepts', async () => {
    expect(await whoIs({ token: 'old', fetch: vi.fn(async () => reply(401, {})) })).toBeNull()
  })
})

describe('signing out', () => {
  it('tells Twitch, and does not care if Twitch cannot be reached', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('offline')
    })

    await expect(revoke({ clientId: 'cid', token: 'tok', fetch })).resolves.toBeUndefined()
    expect(fields(fetch.mock.calls[0][1])).toEqual({ client_id: 'cid', token: 'tok' })
  })
})
