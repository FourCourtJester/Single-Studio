import { describe, expect, it } from 'vitest'

import { EVENTS, normalise, scopesFor } from '../src/events'

describe('chat', () => {
  const event = {
    message_id: 'msg-1',
    chatter_user_id: '1',
    chatter_user_login: 'ada',
    chatter_user_name: 'Ada',
    color: '#FF0000',
    badges: [
      { set_id: 'subscriber', id: '12' },
      { set_id: 'moderator', id: '1' },
    ],
    message: { text: 'hello there', fragments: [{ type: 'text', text: 'hello there' }] },
    message_type: 'text',
  }

  it('gives a graphic what it needs without reaching through the wire shape', () => {
    const { name, payload } = normalise('channel.chat.message', event)

    expect(name).toBe('chat')
    expect(payload).toMatchObject({
      id: 'msg-1',
      text: 'hello there',
      from: { id: '1', login: 'ada', name: 'Ada' },
      colour: '#FF0000',
      badges: ['subscriber', 'moderator'],
      first: false,
    })
  })

  it('keeps fragments, because emotes cannot be rendered without them', () => {
    expect(normalise('channel.chat.message', event).payload.fragments).toEqual([{ type: 'text', text: 'hello there' }])
  })

  it('turns an empty colour into null rather than an empty string', () => {
    // Twitch sends "" for a chatter who never picked one, and `color || fallback`
    // in a graphic works while `color ?? fallback` quietly renders nothing.
    expect(normalise('channel.chat.message', { ...event, color: '' }).payload.colour).toBeNull()
  })

  it('marks a first message, which is the one a show wants to greet', () => {
    expect(normalise('channel.chat.message', { ...event, message_type: 'user_intro' }).payload.first).toBe(true)
  })

  it('flattens a reply into who and what', () => {
    const replying = { ...event, reply: { parent_user_name: 'Kim', parent_message_body: 'first!' } }

    expect(normalise('channel.chat.message', replying).payload.reply).toEqual({ to: 'Kim', text: 'first!' })
  })

  it('leaves reply null when there is not one', () => {
    expect(normalise('channel.chat.message', event).payload.reply).toBeNull()
  })
})

describe('subscriptions', () => {
  it('reads a tier as a number a person would say', () => {
    // "2000" is Twitch's spelling of tier 2. Nobody puts "tier 2000" on air.
    expect(normalise('channel.subscribe', { tier: '2000', user_name: 'Ada' }).payload.tier).toBe(2)
    expect(normalise('channel.subscribe', { tier: '1000' }).payload.tier).toBe(1)
    expect(normalise('channel.subscribe', {}).payload.tier).toBe(1)
  })

  it('carries the message on a resub, which is the point of a resub', () => {
    const { name, payload } = normalise('channel.subscription.message', {
      user_name: 'Ada',
      tier: '1000',
      cumulative_months: 14,
      streak_months: 3,
      message: { text: 'love the show', fragments: [] },
    })

    expect(name).toBe('resub')
    expect(payload).toMatchObject({ months: 14, streak: 3, text: 'love the show' })
  })
})

describe('the anonymous cases', () => {
  it('gives a gifter of null rather than a name of null', () => {
    // The trap: Twitch sends the user fields as null rather than omitting them, so
    // a graphic reading `from.name` renders the word "null" over the programme.
    const { payload } = normalise('channel.subscription.gift', {
      is_anonymous: true,
      user_id: null,
      user_login: null,
      user_name: null,
      total: 5,
      tier: '1000',
    })

    expect(payload.from).toBeNull()
    expect(payload.anonymous).toBe(true)
    expect(payload.count).toBe(5)
  })

  it('does the same for an anonymous cheer', () => {
    const { payload } = normalise('channel.cheer', { is_anonymous: true, user_name: null, bits: 100, message: 'cheer100' })

    expect(payload.from).toBeNull()
    expect(payload.bits).toBe(100)
  })

  it('and names the gifter when there is one', () => {
    const { payload } = normalise('channel.subscription.gift', {
      is_anonymous: false,
      user_id: '9',
      user_login: 'kim',
      user_name: 'Kim',
      total: 1,
      tier: '3000',
    })

    expect(payload.from).toEqual({ id: '9', login: 'kim', name: 'Kim' })
    expect(payload.tier).toBe(3)
  })
})

describe('raids', () => {
  it('reads the raiding channel, not the raided one', () => {
    // Both are on the payload, and picking the wrong one credits the raid to the
    // person being raided.
    const { payload } = normalise('channel.raid', {
      from_broadcaster_user_login: 'kim',
      from_broadcaster_user_name: 'Kim',
      to_broadcaster_user_name: 'Ada',
      viewers: 412,
    })

    expect(payload.from.name).toBe('Kim')
    expect(payload.viewers).toBe(412)
  })
})

describe('everything', () => {
  it('carries the untouched payload, so a missing field is never a blocker', () => {
    const event = { user_name: 'Ada', some_field_added_next_year: true }

    expect(normalise('channel.follow', event).payload.raw).toBe(event)
  })

  it('passes an unknown subscription type through under its wire name', () => {
    // Twitch adds types faster than a plugin tracks them, and a studio that wants a
    // new one should not have to wait for a release.
    const { name, payload } = normalise('channel.charity_campaign.donate', { amount: 500 })

    expect(name).toBe('channel.charity_campaign.donate')
    expect(payload.raw).toEqual({ amount: 500 })
  })
})

describe('scopes', () => {
  it('are derived from the events asked for, not listed twice', () => {
    // The same table drives the subscriptions and the scopes, so they cannot
    // disagree -- asking for an event whose scope was forgotten is a subscription
    // Twitch rejects at connect time.
    expect(scopesFor(['channel.subscribe', 'channel.subscription.gift'])).toEqual(['channel:read:subscriptions'])
    expect(scopesFor(['channel.cheer'])).toEqual(['bits:read'])
  })

  it('leave out the events that need none', () => {
    expect(scopesFor(['channel.raid'])).toEqual([])
  })

  it('cover every event this plugin knows about', () => {
    expect(scopesFor()).toEqual(expect.arrayContaining(['user:read:chat', 'moderator:read:followers', 'channel:read:subscriptions', 'bits:read']))
  })

  it('pins channel.follow to version 2, which is the one that exists', () => {
    // v1 was removed. Subscribing without a version gets a rejection that reads
    // like a scope problem.
    expect(EVENTS['channel.follow'].version).toBe('2')
  })
})
