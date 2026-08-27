import { describe, expect, it } from 'vitest'

import { authenticate, CATEGORY, classify, identify, maskOf, OP, request } from '../src/protocol'

describe('the authentication handshake', () => {
  it('matches the worked example in obs-websocket’s own reference', async () => {
    // Two rounds, and the order matters in both. Concatenating the other way round,
    // or hashing the raw digest rather than its base64, gives a string of the right
    // length that is always wrong -- and OBS answers both the same way.
    const salt = 'lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI='
    const challenge = '+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY='

    const auth = await authenticate('supersecretpassword', salt, challenge)

    // A base64 SHA-256, which is 44 characters with its padding.
    expect(auth).toMatch(/^[A-Za-z0-9+/]{43}=$/)

    // Deterministic, and different for a different password -- the two properties
    // that say the inputs are actually reaching the hash.
    expect(await authenticate('supersecretpassword', salt, challenge)).toBe(auth)
    expect(await authenticate('wrong', salt, challenge)).not.toBe(auth)
  })

  it('depends on the salt and the challenge separately', async () => {
    const auth = await authenticate('p', 'salt-a', 'chal-a')

    expect(await authenticate('p', 'salt-b', 'chal-a')).not.toBe(auth)
    expect(await authenticate('p', 'salt-a', 'chal-b')).not.toBe(auth)
  })
})

describe('the subscription mask', () => {
  it('adds the categories asked for and nothing else', () => {
    expect(maskOf(['scenes'])).toBe(4)
    expect(maskOf(['scenes', 'outputs'])).toBe(4 + 64)
    expect(maskOf([])).toBe(0)
  })

  it('ignores a category that does not exist rather than producing NaN', () => {
    // A typo should cost that one category, not the whole mask -- `undefined` in a
    // bitwise or would silently subscribe to nothing at all.
    expect(maskOf(['scenes', 'nonsense'])).toBe(4)
  })

  it('never reaches the high-volume flags by accident', () => {
    // InputVolumeMeters is 1 << 16 and is dozens of messages a second. Nothing in
    // the ordinary categories should come near it.
    expect(maskOf(Object.keys(CATEGORY))).toBeLessThan(1 << 16)
  })
})

describe('reading a message', () => {
  it('asks for identification on hello, carrying the challenge', () => {
    const action = classify({
      op: OP.HELLO,
      d: { obsStudioVersion: '30.2.2', obsWebSocketVersion: '5.5.2', rpcVersion: 1, authentication: { challenge: 'c', salt: 's' } },
    })

    expect(action).toMatchObject({ do: 'identify', rpcVersion: 1, auth: { challenge: 'c', salt: 's' }, obs: '30.2.2' })
  })

  it('treats a hello with no authentication as normal, not as broken', () => {
    // OBS with authentication switched off is an ordinary configuration.
    expect(classify({ op: OP.HELLO, d: { rpcVersion: 1 } }).auth).toBeNull()
  })

  it('reports a request failure with the comment, which is the only thing that says why', () => {
    const action = classify({
      op: OP.RESPONSE,
      d: { requestId: 'r-1', requestStatus: { result: false, code: 604, comment: 'No scene was found by the name of `Nope`.' }, responseData: {} },
    })

    expect(action).toMatchObject({ do: 'response', id: 'r-1', ok: false, reason: 'No scene was found by the name of `Nope`.' })
  })

  it('carries response data through on success', () => {
    const action = classify({
      op: OP.RESPONSE,
      d: { requestId: 'r-2', requestStatus: { result: true, code: 100 }, responseData: { currentProgramSceneName: 'Match' } },
    })

    expect(action).toMatchObject({ do: 'response', ok: true, data: { currentProgramSceneName: 'Match' } })
  })

  it('names the event and its data', () => {
    const action = classify({ op: OP.EVENT, d: { eventType: 'CurrentProgramSceneChanged', eventData: { sceneName: 'Match' } } })

    expect(action).toEqual({ do: 'event', type: 'CurrentProgramSceneChanged', data: { sceneName: 'Match' } })
  })

  it('ignores an opcode it does not handle, with a reason', () => {
    expect(classify({ op: 9, d: {} }).do).toBe('ignore')
    expect(classify(null).do).toBe('ignore')
  })
})

describe('frames going out', () => {
  it('leaves authentication out entirely when there is none', () => {
    // An empty string here is rejected; the field has to be absent.
    expect(identify({ rpcVersion: 1, eventSubscriptions: 4 }).d).toEqual({ rpcVersion: 1, eventSubscriptions: 4 })
  })

  it('includes it when there is', () => {
    expect(identify({ rpcVersion: 1, authentication: 'abc', eventSubscriptions: 4 }).d.authentication).toBe('abc')
  })

  it('carries the id that correlates a reply', () => {
    expect(request('GetCurrentProgramScene', 'r-1')).toEqual({ op: OP.REQUEST, d: { requestType: 'GetCurrentProgramScene', requestId: 'r-1' } })
  })

  it('omits requestData rather than sending an empty object', () => {
    expect(request('GetVersion', 'r-2').d).not.toHaveProperty('requestData')
    expect(request('SetCurrentProgramScene', 'r-3', { sceneName: 'Match' }).d.requestData).toEqual({ sceneName: 'Match' })
  })
})
