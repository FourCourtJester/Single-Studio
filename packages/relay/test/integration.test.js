import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createVelcroHost } from '../../core/src/velcro/host'
import { createRelay } from '../src/node.js'

// The real client library against the real relay, over a real socket.
//
// room.test.js fakes the wire so it can test the room in isolation, and a fake
// that agrees with the server about a protocol neither implements proves nothing
// on its own. These are y-websocket's own `WebsocketProvider` and, in the second
// half, the actual SharedWorker host a studio runs -- which is what makes this the
// test that catches a handshake the room answers incorrectly rather than not at
// all.

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Poll instead of sleeping and hoping; sockets are fast but not instant. */
const until = async (predicate, timeout = 4000) => {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    if (predicate()) return true
    await wait(25)
  }

  return predicate()
}

let relay = null
let running = null
let closers = []

beforeEach(async () => {
  relay = createRelay({ admin: 'let-me-in' })
  // Port 0: the OS picks a free one, so these never collide with a dev relay.
  running = await relay.listen(0)
})

afterEach(async () => {
  for (const close of closers) await close()
  closers = []
  await running.close()
})

const url = () => `ws://127.0.0.1:${running.port}`

/** A bare y-websocket client, the way any Yjs app would connect. */
function client(room = 'show', token) {
  const doc = new Y.Doc()
  const provider = new WebsocketProvider(url(), room, doc, { WebSocketPolyfill: WebSocket, disableBc: true, params: token ? { token } : {} })

  closers.push(async () => provider.destroy())

  return {
    doc,
    provider,
    set: (key, value) => doc.getMap('state').set(key, value),
    read: (key) => doc.getMap('state').get(key),
    connected: () => until(() => provider.wsconnected),
  }
}

/** A whole studio: the SharedWorker host, with the seam pointed at the relay. */
function studio(room = 'show') {
  const host = createVelcroHost({
    name: room,
    // IndexedDB does not exist here, and it is not what is under test.
    persist: false,
    sync: {
      url: url(),
      room,
      connect: ({ doc, url: at, room: which }) => new WebsocketProvider(at, which, doc, { WebSocketPolyfill: WebSocket, disableBc: true }),
    },
  })

  closers.push(() => host.sync.detach())

  /**
   * One long-lived client port, the way a board is.
   *
   * Subscribing matters and is easy to leave out of a test. With no subscribers the
   * host's publish path never runs, so a whole half of what happens on every
   * transaction -- including remote ones -- goes unexercised.
   */
  const { port1, port2 } = new MessageChannel()

  port1.start()
  host.connect(port2)
  closers.push(async () => (port1.close(), port2.close()))

  const mutate = (name, payload) => port1.postMessage({ type: 'mutate', name, payload })
  const watch = (path) => port1.postMessage({ type: 'subscribe', path })

  return {
    host,
    mutate,
    watch,
    read: (key) => host.doc.getMap('state').get(key),
    ready: async () => {
      await host.started
      await until(() => host.sync.state === 'connected')
    },
  }
}

describe('two y-websocket clients', () => {
  it('converge in both directions', async () => {
    const a = client()

    await a.connected()

    const b = client()

    await b.connected()

    a.set('variables.home.name', 'Vanguard')
    expect(await until(() => b.read('variables.home.name') === 'Vanguard')).toBe(true)

    // The direction that broke in the browser, and the shape that made it break: a
    // Y.Map set is a delete of the old value plus an insert of the new one, so this
    // only lands if the peer holds every operation the insert depends on.
    b.set('variables.home.name', 'Redline')
    expect(await until(() => a.read('variables.home.name') === 'Redline')).toBe(true)

    a.set('variables.home.name', 'Ashfall')
    expect(await until(() => b.read('variables.home.name') === 'Ashfall')).toBe(true)
  })

  it('keeps rooms apart', async () => {
    const a = client('friday')

    await a.connected()

    const b = client('saturday')

    await b.connected()

    a.set('variables.home.name', 'Vanguard')
    await wait(300)

    expect(b.read('variables.home.name')).toBeUndefined()
  })
})

describe('two studios', () => {
  it('converge through the relay, host to host', async () => {
    // The stage-2 claim, minus the browser: two SharedWorker hosts, each with its
    // own document, agreeing through a relay neither of them trusts.
    const a = studio()

    await a.ready()

    const b = studio()

    await b.ready()

    a.mutate('set', { 'variables.home.name': 'Vanguard' })
    expect(await until(() => b.read('variables.home.name') === 'Vanguard')).toBe(true)

    b.mutate('set', { 'variables.home.name': 'Redline' })
    expect(await until(() => a.read('variables.home.name') === 'Redline')).toBe(true)
  })

  it('converges while both are publishing to subscribers', async () => {
    // A board is always subscribed to the paths it shows, so every transaction --
    // remote ones included -- runs the host's publish path inside Yjs's own
    // afterTransaction. A test with no subscribers never exercises that at all,
    // which is most of what a real host does on a remote update.
    const a = studio()

    await a.ready()

    const b = studio()

    await b.ready()

    a.watch('variables.home.name')
    b.watch('variables.home.name')
    await wait(100)

    a.mutate('set', { 'variables.home.name': 'Vanguard' })
    expect(await until(() => b.read('variables.home.name') === 'Vanguard')).toBe(true)

    // The shape that broke: replacing a value the other side already holds.
    b.mutate('set', { 'variables.home.name': 'Redline' })
    expect(await until(() => a.read('variables.home.name') === 'Redline')).toBe(true)

    a.mutate('set', { 'variables.home.name': 'Ashfall' })
    expect(await until(() => b.read('variables.home.name') === 'Ashfall')).toBe(true)
  })

  it('adds concurrent increments up rather than losing one', async () => {
    // The regression the whole store exists to prevent, end to end: two operators
    // tapping +1 inside the replication window must produce +2. Under a plain
    // last-write-wins map this is +1 -- a scoreboard quietly lying on air.
    const a = studio()

    await a.ready()

    const b = studio()

    await b.ready()

    a.mutate('increment', 'variables.home.score')
    b.mutate('increment', 'variables.home.score')

    const score = (which) => {
      const bases = which.host.doc.getMap('counters')
      const deltas = which.host.doc.getMap('deltas')

      if (!bases.has('variables.home.score')) return undefined

      return [...deltas.entries()].reduce((total, [, value]) => total + value, bases.get('variables.home.score'))
    }

    expect(await until(() => score(a) === 2, 6000)).toBe(true)
    expect(await until(() => score(b) === 2, 6000)).toBe(true)
  })

  it('hands a late joiner the show as it stands', async () => {
    const a = studio()

    await a.ready()

    a.mutate('set', { 'variables.home.name': 'Vanguard' })
    a.mutate('set', { 'variables.period': 'Game 2' })

    await wait(300)

    const b = studio()

    await b.ready()

    expect(await until(() => b.read('variables.home.name') === 'Vanguard')).toBe(true)
    expect(b.read('variables.period')).toBe('Game 2')
  })
})

describe('access control', () => {
  const api = (path, options = {}) =>
    fetch(`http://127.0.0.1:${running.port}${path}`, { ...options, headers: { authorization: 'Bearer let-me-in', ...options.headers } })

  it('leaves a room nobody has issued a token for open', async () => {
    // The development case and the single-operator case. Demanding a token before
    // anyone has minted one means a relay that does nothing until you read the
    // manual.
    const a = client('open')

    expect(await a.connected()).toBe(true)
  })

  it('guards the room as soon as one token exists', async () => {
    await api('/guarded/tokens', { method: 'POST', body: JSON.stringify({ name: 'Dez' }) })

    const stranger = client('guarded')

    // Refused before the upgrade, so the client never reports itself connected.
    await wait(600)
    expect(stranger.provider.wsconnected).toBe(false)
  })

  it('lets the operator it was issued to in', async () => {
    const minted = await api('/mine/tokens', { method: 'POST', body: JSON.stringify({ name: 'Dez' }) }).then((r) => r.json())
    const dez = client('mine', minted.token.secret)

    expect(await dez.connected()).toBe(true)
  })

  it('hangs up on a revoked operator immediately, not at their next reconnect', async () => {
    // The moment this has to work is the moment somebody is removed mid-show.
    // Waiting for a reconnect means they keep editing until they happen to
    // refresh, which is precisely when you needed it.
    const minted = await api('/kick/tokens', { method: 'POST', body: JSON.stringify({ name: 'Sam' }) }).then((r) => r.json())
    const sam = client('kick', minted.token.secret)

    expect(await sam.connected()).toBe(true)

    await api(`/kick/tokens/${minted.token.id}`, { method: 'DELETE' })

    expect(await until(() => !sam.provider.wsconnected)).toBe(true)
  })

  it('leaves everyone else connected when one operator is removed', async () => {
    const dez = await api('/crew/tokens', { method: 'POST', body: JSON.stringify({ name: 'Dez' }) }).then((r) => r.json())
    const sam = await api('/crew/tokens', { method: 'POST', body: JSON.stringify({ name: 'Sam' }) }).then((r) => r.json())

    const first = client('crew', dez.token.secret)

    await first.connected()

    const second = client('crew', sam.token.secret)

    await second.connected()

    await api(`/crew/tokens/${sam.token.id}`, { method: 'DELETE' })
    await until(() => !second.provider.wsconnected)

    // The whole point of per-operator tokens: removing one person is not an event
    // for the other three.
    expect(first.provider.wsconnected).toBe(true)

    first.set('variables.home.name', 'Vanguard')
    await wait(300)
    expect(relay.rooms.get('crew').doc.getMap('state').get('variables.home.name')).toBe('Vanguard')
  })

  it('refuses the admin API without the admin secret', async () => {
    const naked = await fetch(`http://127.0.0.1:${running.port}/friday/tokens`)

    expect(naked.status).toBe(401)

    const wrong = await fetch(`http://127.0.0.1:${running.port}/friday/tokens`, { headers: { authorization: 'Bearer nope' } })

    expect(wrong.status).toBe(401)
  })

  it('never lists a secret, having handed it over once', async () => {
    const minted = await api('/listing/tokens', { method: 'POST', body: JSON.stringify({ name: 'Dez' }) }).then((r) => r.json())

    expect(minted.token.secret).toBeTypeOf('string')

    const listed = await api('/listing/tokens').then((r) => r.json())

    expect(listed.tokens[0]).not.toHaveProperty('secret')
    expect(listed.tokens[0]).toMatchObject({ name: 'Dez' })
  })
})

describe('a relay with no admin secret', () => {
  it('turns the token API off rather than leaving it open', async () => {
    // An unguarded mint endpoint is a worse default than no endpoint: anyone who
    // can reach the port could issue themselves a way in.
    const bare = createRelay()
    const up = await bare.listen(0)

    const response = await fetch(`http://127.0.0.1:${up.port}/friday/tokens`, { method: 'POST', body: '{}' })

    expect(response.status).toBe(404)

    await up.close()
  })
})
