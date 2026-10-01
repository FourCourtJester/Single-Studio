import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeSocket, fakeSockets } from '@single-studio/core/testing'

import { twitch, TwitchHandler } from '../src/index'

// The plugin signing in, staying signed in, and finding its channel -- against a
// fake Twitch that answers by URL. See auth.test.js for each request on its own.

class EventSubSocket extends FakeSocket {
  welcome(session = 'sess-1') {
    this.deliver({
      metadata: { message_id: `m-${Math.random()}`, message_type: 'session_welcome', message_timestamp: new Date().toISOString() },
      payload: { session: { id: session, keepalive_timeout_seconds: 10 } },
    })
  }
}

const { sockets, Socket, reset } = fakeSockets(EventSubSocket)

const reply = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

/** Twitch, as far as this plugin can tell. Each test overrides the answers it cares about. */
let answers

const twitchApi = vi.fn(async (url, init = {}) => {
  const path = String(url)

  if (path.endsWith('/oauth2/device')) return answers.device()
  if (path.endsWith('/oauth2/token')) return answers.token(Object.fromEntries(new URLSearchParams(init.body)))
  if (path.endsWith('/oauth2/validate')) return answers.validate()
  if (path.endsWith('/oauth2/revoke')) return reply(200)
  if (path.includes('/helix/users')) return answers.users(path)
  if (path.includes('/eventsub/subscriptions')) return answers.subscribe(JSON.parse(init.body), init.headers)

  throw new Error(`unexpected request to ${path}`)
})

const calls = (fragment) => twitchApi.mock.calls.filter(([url]) => String(url).includes(fragment))

/** Build the plugin the way the host would, with a `save` that records what it was given. */
const build = (config = {}, options = { clientId: 'cid' }) => {
  const save = vi.fn(async () => ({ ok: true }))
  const plugin = twitch(TwitchHandler, { events: ['chat'], ...options }).create({
    mutate: vi.fn(),
    owner: () => true,
    studio: 's',
    save,
    config,
  })

  return { plugin, save }
}

const signedIn = { token: 'tok', refresh: 'ref', expiresAt: Date.now() + 3_600_000, userId: '123', login: 'me' }

beforeEach(() => {
  reset()
  answers = {
    device: () => reply(200, { device_code: 'dev', user_code: 'WDJB-MJHT', verification_uri: 'https://www.twitch.tv/activate', interval: 5, expires_in: 600 }),
    token: () => reply(400, { message: 'authorization_pending' }),
    validate: () => reply(200, { user_id: '123', login: 'me' }),
    users: () => reply(200, { data: [{ id: '999', login: 'them' }] }),
    subscribe: () => reply(202),
  }
  vi.stubGlobal('WebSocket', Socket)
  vi.stubGlobal('fetch', twitchApi)
  twitchApi.mockClear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('signed out', () => {
  it('offers to sign in, and says that is what is missing', async () => {
    const { plugin } = build()

    expect(plugin.offers).toEqual(['signIn'])
    await expect(plugin.open()).rejects.toThrow(/Not signed in to Twitch yet. Press Sign in with Twitch/)
  })

  it('says whose job a missing Client ID is, rather than asking the operator for one', async () => {
    const { plugin } = build({}, {})

    await expect(plugin.act('signIn')).rejects.toThrow(/no Twitch Client ID. Its author sets one/)
  })
})

describe('signing in', () => {
  it('comes back with a code to type, without waiting for it to be typed', async () => {
    const { plugin } = build()

    await plugin.act('signIn')

    expect(plugin.notice).toMatchObject({ code: 'WDJB-MJHT', href: 'https://www.twitch.tv/activate' })
    expect(plugin.offers).toEqual(['cancel'])
  })

  it('asks for exactly the permissions its events need', async () => {
    const { plugin } = build({}, { clientId: 'cid', events: ['chat', 'cheer'] })

    await plugin.act('signIn')

    expect(new URLSearchParams(calls('/oauth2/device')[0][1].body).get('scopes')).toBe('user:read:chat bits:read')
  })

  it('keeps asking at Twitch’s pace, then stores who signed in and restarts on it', async () => {
    const { plugin, save } = build()
    let asked = 0

    answers.token = () =>
      ++asked < 3 ? reply(400, { message: 'authorization_pending' }) : reply(200, { access_token: 'new', refresh_token: 'r', expires_in: 14_000 })

    await plugin.act('signIn')
    await vi.advanceTimersByTimeAsync(4_999)
    expect(asked).toBe(0)

    await vi.advanceTimersByTimeAsync(15_001)

    expect(asked).toBe(3)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0]).toMatchObject({ token: 'new', refresh: 'r', userId: '123', login: 'me' })
    // Restarted: no `{ restart: false }`, so the host rebuilds the plugin on it.
    expect(save.mock.calls[0][1]).toBeUndefined()
    expect(plugin.notice).toBeNull()
  })

  it('slows down when Twitch says to', async () => {
    const { plugin } = build()
    let asked = 0

    answers.token = () => {
      asked += 1

      return reply(400, { message: asked === 1 ? 'slow_down' : 'authorization_pending' })
    }

    await plugin.act('signIn')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(asked).toBe(1)

    // Five more seconds on the interval: nothing at the old pace, one at the new.
    await vi.advanceTimersByTimeAsync(5_000)
    expect(asked).toBe(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(asked).toBe(2)
  })

  it('says so when the operator refuses, and offers to start again', async () => {
    const { plugin, save } = build()

    answers.token = () => reply(400, { message: 'authorization_denied' })

    await plugin.act('signIn')
    await vi.advanceTimersByTimeAsync(5_000)

    expect(plugin.notice.text).toMatch(/authorization_denied/)
    expect(plugin.offers).toEqual(['signIn'])
    expect(save).not.toHaveBeenCalled()
  })

  it('says so when the code runs out before anyone types it', async () => {
    const { plugin } = build()

    answers.device = () => reply(200, { device_code: 'dev', user_code: 'X', verification_uri: 'u', interval: 5, expires_in: 8 })

    await plugin.act('signIn')
    await vi.advanceTimersByTimeAsync(10_000)

    expect(plugin.notice.text).toMatch(/ran out before it was entered/)
  })

  it('stops asking when cancelled', async () => {
    const { plugin } = build()

    await plugin.act('signIn')
    await plugin.act('cancel')
    await vi.advanceTimersByTimeAsync(30_000)

    expect(calls('/oauth2/token')).toHaveLength(0)
    expect(plugin.offers).toEqual(['signIn'])
    expect(plugin.notice).toBeNull()
  })

  it('stops asking when the plugin is stopped, so a sign-in does not outlive it', async () => {
    const { plugin } = build()

    await plugin.act('signIn')
    await plugin.stop()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(calls('/oauth2/token')).toHaveLength(0)
  })
})

describe('signed in', () => {
  it('says who, and offers to sign out', () => {
    const { plugin } = build(signedIn)

    expect(plugin.notice).toEqual({ text: 'Signed in as me.' })
    expect(plugin.offers).toEqual(['signOut'])
  })

  it('signs out by telling Twitch and clearing everything that named the account', async () => {
    const { plugin, save } = build(signedIn)

    await plugin.act('signOut')

    expect(calls('/oauth2/revoke')).toHaveLength(1)
    expect(save).toHaveBeenCalledWith({ token: '', refresh: '', expiresAt: 0, userId: '', login: '' })
  })

  it('watches its own channel when none is typed', async () => {
    const { plugin } = build(signedIn)
    const opening = plugin.open()

    await vi.advanceTimersByTimeAsync(0)
    sockets[0].welcome()
    await opening

    expect(JSON.parse(calls('/eventsub/subscriptions')[0][1].body).condition).toEqual({ broadcaster_user_id: '123', user_id: '123' })
  })

  it('looks up a channel typed by name, for a moderator running somebody else’s board', async () => {
    const { plugin } = build({ ...signedIn, channel: 'Them' })
    const opening = plugin.open()

    await vi.advanceTimersByTimeAsync(0)
    sockets[0].welcome()
    await opening

    expect(calls('/helix/users')[0][0]).toBe('https://api.twitch.tv/helix/users?login=them')
    // Watching their channel, as themselves.
    expect(JSON.parse(calls('/eventsub/subscriptions')[0][1].body).condition).toEqual({ broadcaster_user_id: '999', user_id: '123' })
  })

  it('says so when the typed channel does not exist', async () => {
    answers.users = () => reply(200, { data: [] })

    await expect(build({ ...signedIn, channel: 'nobody' }).plugin.open()).rejects.toThrow(/no Twitch channel called "nobody"/)
  })
})

// The plugin carries on with whatever Twitch will send, which is right -- chat is
// worth having without cheers -- and used to be silent about the rest, in a console
// inside a SharedWorker. A graphic that never shows a sub looks exactly like a
// quiet night, so the panel says.
describe('events Twitch will not send to this sign-in', () => {
  const refusing = (...refused) => {
    answers.subscribe = (body) => reply(refused.includes(body.type) ? 403 : 202)
  }

  const connected = async (config, events) => {
    const { plugin } = build({ ...signedIn, ...config }, { clientId: 'cid', events })
    const opening = plugin.open()

    await vi.advanceTimersByTimeAsync(0)
    sockets[0].welcome()
    await opening

    return plugin
  }

  it('are named on the panel, in the words the help uses', async () => {
    refusing('channel.subscribe', 'channel.cheer')

    const plugin = await connected({}, ['chat', 'subscribe', 'cheer'])

    expect(plugin.notice.text).toBe('Signed in as me. Twitch will not send subs and cheers to this sign-in.')
  })

  it('say why when the channel is somebody else’s, because then it is not a fault', async () => {
    refusing('channel.subscribe')

    const plugin = await connected({ channel: 'Them' }, ['chat', 'subscribe'])

    expect(plugin.notice.text).toMatch(/will not send subs to this sign-in\. On somebody else’s channel, only its owner’s sign-in gets those\./)
  })

  it('leave the line alone when everything came through', async () => {
    const plugin = await connected({}, ['chat', 'cheer'])

    expect(plugin.notice.text).toBe('Signed in as me.')
  })
})

// Connecting is two round trips to Twitch before the socket is even dialled, then a
// welcome and a subscription per event: seconds, during which the plugin is neither
// up nor down. The worker rechecks every plugin on each sync status change, and at
// startup every page opened is one. Each used to start it again, and each left a
// socket subscribed -- one chat message, three times on screen.
describe('while it is still connecting', () => {
  /** Hold the channel lookup until the test lets it answer. */
  const holdLookup = () => {
    const held = Promise.withResolvers()

    answers.users = () => held.promise.then(() => reply(200, { data: [{ id: '999', login: 'them' }] }))

    return held
  }

  it('connects once however many times it is rechecked', async () => {
    const held = holdLookup()
    const { plugin } = build({ ...signedIn, channel: 'Them' })
    const starting = [plugin.start(), plugin.recheck(), plugin.recheck()]

    held.resolve()
    await vi.advanceTimersByTimeAsync(0)

    // Counted before the welcome: with three sockets, only the last start would
    // ever hear back, and the test would hang instead of saying how many.
    expect(sockets).toHaveLength(1)

    sockets[0].welcome()
    await Promise.all(starting)

    expect(calls('/eventsub/subscriptions')).toHaveLength(1)
  })

  it('does not dial at all once it has been stopped', async () => {
    // A restart -- Save on the panel, or signing in -- stops this plugin and builds
    // a new one. Stopped mid-lookup, the old one used to carry on and dial anyway.
    const held = holdLookup()
    const { plugin } = build({ ...signedIn, channel: 'Them' })
    const starting = plugin.start()

    await vi.advanceTimersByTimeAsync(0)
    await plugin.stop()
    held.resolve()
    await vi.advanceTimersByTimeAsync(0)

    expect(sockets).toHaveLength(0)

    await starting

    expect(plugin.status).toBe('idle')
  })
})

describe('staying signed in', () => {
  it('refreshes a token about to run out before connecting, and keeps the new one without a restart', async () => {
    const { plugin, save } = build({ ...signedIn, expiresAt: Date.now() + 60_000 })

    answers.token = (form) =>
      form.grant_type === 'refresh_token' ? reply(200, { access_token: 'fresh', refresh_token: 'ref2', expires_in: 14_000 }) : reply(400)

    const opening = plugin.open()

    await vi.advanceTimersByTimeAsync(0)
    sockets[0].welcome()
    await opening

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ token: 'fresh', refresh: 'ref2' }), { restart: false })
    expect(calls('/eventsub/subscriptions')[0][1].headers.Authorization).toBe('Bearer fresh')
  })

  it('does not refresh a token with time left on it', async () => {
    const { plugin } = build(signedIn)
    const opening = plugin.open()

    await vi.advanceTimersByTimeAsync(0)
    sockets[0].welcome()
    await opening

    expect(calls('/oauth2/token')).toHaveLength(0)
  })

  it('signs the machine out when Twitch refuses the refresh, rather than retrying forever', async () => {
    const { plugin, save } = build({ ...signedIn, expiresAt: Date.now() + 60_000 })

    answers.token = () => reply(400, { message: 'Invalid refresh token' })

    await expect(plugin.open()).rejects.toThrow(/signed this machine out/)
    expect(save).toHaveBeenCalledWith({ token: '', refresh: '', expiresAt: 0, userId: '', login: '' }, { restart: false })
    expect(plugin.offers).toEqual(['signIn'])
  })

  it('refreshes once and tries again when every subscription comes back unauthorised', async () => {
    const { plugin } = build(signedIn)
    let refused = 0

    answers.subscribe = (body, headers) => (headers.Authorization === 'Bearer tok' ? (refused++, reply(401)) : reply(202))
    answers.token = () => reply(200, { access_token: 'fresh', refresh_token: 'ref2', expires_in: 14_000 })

    const opening = plugin.open()

    await vi.advanceTimersByTimeAsync(0)
    sockets[0].welcome()

    await expect(opening).resolves.toBeUndefined()
    expect(refused).toBe(1)
    expect(calls('/oauth2/token')).toHaveLength(1)
  })
})

describe('the studio author’s options', () => {
  it('takes the Client ID from the build, and asks nobody for it', () => {
    const definition = twitch(TwitchHandler, { clientId: 'cid' })

    expect(definition.config.map((field) => field.key)).toEqual(['channel'])
  })

  it('asks the operator only when the build did not bring one', () => {
    expect(twitch(TwitchHandler).config.map((field) => field.key)).toEqual(['clientId', 'channel'])
  })

  it('narrows the events by the names its handler uses, or by Twitch’s', async () => {
    // The author's call rather than a box on the panel: it decides what Twitch asks
    // a streamer to approve, and a typo at the board used to switch events off.
    const { plugin } = build(signedIn, { clientId: 'cid', events: ['chat', 'channel.raid'] })
    const opening = plugin.open()

    await vi.advanceTimersByTimeAsync(0)
    sockets[0].welcome()
    await opening

    expect(calls('/eventsub/subscriptions').map(([, init]) => JSON.parse(init.body).type)).toEqual(['channel.chat.message', 'channel.raid'])
  })

  it('takes every event when the author names none', async () => {
    const { plugin } = build(signedIn, { clientId: 'cid', events: undefined })
    const opening = plugin.open()

    await vi.advanceTimersByTimeAsync(0)
    sockets[0].welcome()
    await opening

    expect(calls('/eventsub/subscriptions')).toHaveLength(7)
  })

  it('in mock mode, talks to the Twitch CLI on this machine with no sign-in at all', async () => {
    const { plugin } = build({}, { mock: true })
    const opening = plugin.open()

    await vi.advanceTimersByTimeAsync(0)

    expect(sockets[0].url).toBe('ws://127.0.0.1:8080/ws')

    sockets[0].welcome()
    await opening

    expect(calls('/eventsub/subscriptions')[0][0]).toBe('http://127.0.0.1:8080/eventsub/subscriptions')
    expect(plugin.offers).toEqual([])
    expect(plugin.notice.text).toMatch(/Mock mode/)
  })
})
