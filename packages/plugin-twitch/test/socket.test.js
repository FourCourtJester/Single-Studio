import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { twitch, TwitchHandler } from '../src/index'

// A WebSocket that does nothing until a test tells it to, so the handover and the
// watchdog can be driven exactly rather than waited for.
const sockets = []

class FakeSocket {
  constructor(url) {
    this.url = url
    this.closed = false
    this.listeners = {}
    sockets.push(this)
  }

  addEventListener(type, fn) {
    ;(this.listeners[type] ??= []).push(fn)
  }

  close() {
    this.closed = true
  }

  /** Deliver a message as Twitch would. */
  send(metadata, payload) {
    const data = JSON.stringify({ metadata: { message_id: `m-${Math.random()}`, message_timestamp: new Date().toISOString(), ...metadata }, payload })

    for (const fn of this.listeners.message ?? []) fn({ data })
  }

  welcome(session = 'sess-1', keepalive = 10) {
    this.send({ message_type: 'session_welcome' }, { session: { id: session, keepalive_timeout_seconds: keepalive } })
  }
}

const config = { clientId: 'cid', broadcasterId: '123', userId: '123', token: 'tok', events: 'channel.chat.message' }

/** Build the plugin the way the host would, with a handler attached. */
const build = (Handler, over = {}) => {
  const definition = twitch(Handler)

  return definition.create({ mutate: vi.fn(), owner: () => true, studio: 's', config: { ...config, ...over } })
}

beforeEach(() => {
  sockets.length = 0
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 202 })),
  )
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('connecting', () => {
  it('refuses to start without the things it cannot work without', async () => {
    // Said at the point of the mistake rather than as a socket error later.
    await expect(build(TwitchHandler, { token: '' }).open()).rejects.toThrow(/signed in/i)
    await expect(build(TwitchHandler, { clientId: '' }).open()).rejects.toThrow(/Client ID/i)
    await expect(build(TwitchHandler, { broadcasterId: '' }).open()).rejects.toThrow(/broadcaster/i)
  })

  it('creates subscriptions only after the welcome, using the session it names', async () => {
    // The session id is what ties a subscription to this socket, and it does not
    // exist until Twitch says so.
    const plugin = build(TwitchHandler)
    const opening = plugin.open()

    expect(fetch).not.toHaveBeenCalled()

    sockets[0].welcome('sess-42')
    await opening

    const [, request] = fetch.mock.calls[0]

    expect(JSON.parse(request.body).transport).toEqual({ method: 'websocket', session_id: 'sess-42' })
    expect(request.headers['Client-Id']).toBe('cid')
    expect(request.headers.Authorization).toBe('Bearer tok')
  })

  it('keeps going when some subscriptions are refused but not all', async () => {
    // A studio missing `bits:read` should still get chat rather than a dead plugin.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, request) => ({ ok: JSON.parse(request.body).type === 'channel.chat.message', status: 403 })),
    )

    const plugin = build(TwitchHandler, { events: 'channel.chat.message,channel.cheer' })
    const opening = plugin.open()

    sockets[0].welcome()

    await expect(opening).resolves.toBeUndefined()
  })

  it('gives up when every one is refused, saying so', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401 })),
    )

    const plugin = build(TwitchHandler)
    const opening = plugin.open()

    sockets[0].welcome()

    await expect(opening).rejects.toThrow(/refused every subscription/)
  })
})

describe('delivering', () => {
  it('reaches the studio handler in the shape the plugin promises', async () => {
    const seen = vi.fn()

    class MyShow extends TwitchHandler {
      onChat(...args) {
        seen(...args)
      }
    }

    const plugin = build(MyShow)
    const opening = plugin.open()

    sockets[0].welcome()
    await opening

    sockets[0].send(
      { message_type: 'notification' },
      {
        subscription: { type: 'channel.chat.message' },
        event: { chatter_user_name: 'Ada', chatter_user_login: 'ada', message: { text: 'hi', fragments: [] } },
      },
    )

    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ text: 'hi', from: expect.objectContaining({ name: 'Ada' }) }))
  })
})

describe('the reconnect handover', () => {
  it('keeps the old socket until the new one has welcomed, then drops it', async () => {
    // The whole point of Twitch handing over a URL rather than closing: nothing is
    // missed in between. Closing early loses whatever arrives in the gap.
    const plugin = build(TwitchHandler)
    const opening = plugin.open()

    sockets[0].welcome('sess-1')
    await opening

    sockets[0].send({ message_type: 'session_reconnect' }, { session: { reconnect_url: 'wss://twitch/again' } })

    expect(sockets).toHaveLength(2)
    expect(sockets[1].url).toBe('wss://twitch/again')
    expect(sockets[0].closed).toBe(false)

    sockets[1].welcome('sess-2')

    expect(sockets[0].closed).toBe(true)
  })

  it('does not re-create subscriptions, because Twitch carries them over', async () => {
    const plugin = build(TwitchHandler)
    const opening = plugin.open()

    sockets[0].welcome('sess-1')
    await opening

    const before = fetch.mock.calls.length

    sockets[0].send({ message_type: 'session_reconnect' }, { session: { reconnect_url: 'wss://twitch/again' } })
    sockets[1].welcome('sess-2')

    expect(fetch.mock.calls.length).toBe(before)
  })
})

describe('the watchdog', () => {
  it('treats silence as a drop, since a dead socket need not close', async () => {
    // The failure this exists for leaves a chat overlay looking healthy and frozen.
    const plugin = build(TwitchHandler)
    const opening = plugin.open()

    sockets[0].welcome('sess-1', 10)
    await opening

    const dropped = vi.spyOn(plugin, 'dropped').mockImplementation(() => {})

    vi.advanceTimersByTime(14_000)
    expect(dropped).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2_000)
    expect(dropped).toHaveBeenCalled()
  })

  it('is reset by any message, not only by a keepalive', async () => {
    const plugin = build(TwitchHandler)
    const opening = plugin.open()

    sockets[0].welcome('sess-1', 10)
    await opening

    const dropped = vi.spyOn(plugin, 'dropped').mockImplementation(() => {})

    vi.advanceTimersByTime(10_000)
    sockets[0].send({ message_type: 'notification' }, { subscription: { type: 'channel.cheer' }, event: { bits: 1 } })
    vi.advanceTimersByTime(10_000)

    expect(dropped).not.toHaveBeenCalled()
  })
})
