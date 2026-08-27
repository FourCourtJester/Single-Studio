import { beforeEach, describe, expect, it } from 'vitest'

import { Protocol } from '../src/protocol'

let clock = Date.parse('2026-08-27T12:00:00Z')

const at = (offsetMs = 0) => new Date(clock + offsetMs).toISOString()

/** A message in Twitch's envelope. */
const message = (type, payload = {}, { id = `m-${Math.random()}`, timestamp = at() } = {}) => ({
  metadata: { message_id: id, message_type: type, message_timestamp: timestamp },
  payload,
})

const welcome = (session = 'abc123', keepalive = 10) =>
  message('session_welcome', { session: { id: session, status: 'connected', keepalive_timeout_seconds: keepalive } })

let protocol

beforeEach(() => {
  clock = Date.parse('2026-08-27T12:00:00Z')
  protocol = new Protocol(() => clock)
})

describe('the welcome', () => {
  it('hands back the session to subscribe with', () => {
    // Nothing arrives until subscriptions exist, and they need this id.
    expect(protocol.handle(welcome('sess-1', 30))).toEqual({ do: 'subscribe', session: 'sess-1', keepalive: 30 })
    expect(protocol.sessionId).toBe('sess-1')
  })

  it('sizes the silence budget from what Twitch said, not from a guess', () => {
    protocol.handle(welcome('sess-1', 30))

    // The keepalive plus a margin: one arriving exactly on time is on time.
    expect(protocol.silenceBudgetMs).toBe(35_000)
  })

  it('falls back to the documented default when the field is absent', () => {
    protocol.handle(message('session_welcome', { session: { id: 'sess-1' } }))

    expect(protocol.silenceBudgetMs).toBe(15_000)
  })
})

describe('notifications', () => {
  it('carries the type and the event through', () => {
    protocol.handle(welcome())

    const action = protocol.handle(
      message('notification', {
        subscription: { type: 'channel.cheer' },
        event: { bits: 100 },
      }),
    )

    expect(action).toEqual({ do: 'deliver', type: 'channel.cheer', event: { bits: 100 } })
  })
})

describe('replay protection', () => {
  it('handles a message once, however many times it arrives', () => {
    // A redelivered subscriber alert is indistinguishable from a real one to
    // everything downstream, and it is on air before anybody can stop it.
    const notification = message('notification', { subscription: { type: 'channel.subscribe' }, event: {} }, { id: 'dup-1' })

    expect(protocol.handle(notification).do).toBe('deliver')
    expect(protocol.handle(notification)).toEqual({ do: 'ignore', reason: 'already handled' })
  })

  it('applies to every kind of message, not only notifications', () => {
    const again = message('session_reconnect', { session: { reconnect_url: 'wss://x' } }, { id: 'dup-2' })

    expect(protocol.handle(again).do).toBe('reconnect')
    expect(protocol.handle(again).do).toBe('ignore')
  })

  it('drops anything older than ten minutes', () => {
    const stale = message('notification', { subscription: { type: 'channel.cheer' }, event: {} }, { timestamp: at(-11 * 60 * 1000) })

    expect(protocol.handle(stale)).toEqual({ do: 'ignore', reason: 'older than ten minutes' })
  })

  it('keeps one that is merely old', () => {
    const recent = message('notification', { subscription: { type: 'channel.cheer' }, event: {} }, { timestamp: at(-9 * 60 * 1000) })

    expect(recent && protocol.handle(recent).do).toBe('deliver')
  })

  it('does not grow without bound over a long stream', () => {
    for (let i = 0; i < 1200; i += 1) {
      protocol.handle(message('session_keepalive', {}, { id: `k-${i}` }))
    }

    // The oldest are forgotten, so the earliest id is treated as new again rather
    // than the set growing for the length of a broadcast.
    expect(protocol.handle(message('session_keepalive', {}, { id: 'k-0' })).do).toBe('alive')
  })
})

describe('reconnect', () => {
  it('hands over the URL Twitch supplied', () => {
    // The old socket keeps delivering until the new one has welcomed, which is why
    // Twitch sends a URL rather than just closing.
    const action = protocol.handle(message('session_reconnect', { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?challenge=x' } }))

    expect(action).toEqual({ do: 'reconnect', url: 'wss://eventsub.wss.twitch.tv/ws?challenge=x' })
  })
})

describe('revocation', () => {
  it('says which subscription went and why', () => {
    // A revoked subscription is silent otherwise: the events simply stop, and the
    // overlay looks fine.
    const action = protocol.handle(
      message('revocation', {
        subscription: { type: 'channel.follow', status: 'authorization_revoked' },
      }),
    )

    expect(action).toEqual({ do: 'revoked', type: 'channel.follow', reason: 'authorization_revoked' })
  })
})

describe('anything else', () => {
  it('is ignored with a reason rather than thrown', () => {
    expect(protocol.handle(message('something_new')).do).toBe('ignore')
    expect(protocol.handle({}).do).toBe('ignore')
    expect(protocol.handle(null).do).toBe('ignore')
  })
})
