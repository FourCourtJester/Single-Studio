import * as Y from 'yjs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Doc from '../src/velcro/doc'
import { createVelcroHost } from '../src/velcro/host'
import { channelFor, statusChannelFor } from '../src/velcro/channels'
import { CONNECTED, CONNECTING, ERROR, OFFLINE } from '../src/velcro/sync'

// Persistence is off throughout: IndexedDB does not exist here, and the seam is
// about the transport rather than the store beneath it. BroadcastChannel and
// MessageChannel are both Node globals, so the host itself runs unmodified.

let live = []

const host = (config = {}) => {
  const made = createVelcroHost({ persist: false, ...config })

  live.push(made)

  return made
}

/** Collect status messages, the way a control surface would. */
const watch = (name) => {
  const channel = new BroadcastChannel(statusChannelFor(name))
  const seen = []

  channel.onmessage = ({ data }) => seen.push(data)
  live.push({ close: () => channel.close() })

  return seen
}

/** One connected client, with the messages it received. */
const client = (made) => {
  const { port1, port2 } = new MessageChannel()
  const seen = []

  port1.onmessage = ({ data }) => seen.push(data)
  port1.start()
  made.connect(port2)
  live.push({ close: () => (port1.close(), port2.close()) })

  return { port: port1, seen }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

afterEach(() => {
  for (const made of live) made.close?.()
  live = []
})

describe('a host with no sync configured', () => {
  it('reports itself offline and never builds a provider', async () => {
    const made = host({ name: `quiet-${Math.random()}` })

    await made.started

    expect(made.sync.configured).toBe(false)
    expect(made.sync.state).toBe(OFFLINE)
  })

  it('says nothing on the status channel beyond ready', async () => {
    // The property that makes this seam safe to add before the relay exists: a
    // single-operator studio behaves exactly as it did, down to the messages on
    // the wire. An "offline" announcement would be traffic that never existed.
    const name = `silent-${Math.random()}`
    const seen = watch(name)
    const made = host({ name })

    await made.started
    await settle()

    expect(seen.map((message) => message.type)).toEqual(['ready'])
  })

  it('still serves a status request, for a board that always asks', async () => {
    const made = host({ name: `asked-${Math.random()}` })
    const { port, seen } = client(made)

    await made.started
    port.postMessage({ type: 'sync:status' })
    await settle()

    expect(seen.find((message) => message.type === 'sync')).toMatchObject({ state: OFFLINE })
  })
})

describe('attaching a provider', () => {
  it('builds one only after startup has finished, never during construction', async () => {
    // Ordering that matters: a provider syncing before the local document has
    // loaded either pushes a half-empty room or has the replay land on top of
    // remote state. Both look like data loss from the outside. Construction
    // returning without a connection is the observable half of that guarantee.
    const build = vi.fn(() => ({ destroy() {} }))
    const made = host({ name: `ordered-${Math.random()}`, sync: { connect: build } })

    expect(build).not.toHaveBeenCalled()

    await made.started
    await settle()

    expect(build).toHaveBeenCalledOnce()
  })

  it('hands the provider the doc and the room it was configured with', async () => {
    const build = vi.fn(() => ({ destroy() {} }))
    const made = host({ name: `wired-${Math.random()}`, sync: { connect: build, room: 'friday-show', url: 'wss://relay.test', token: 'abc' } })

    await made.started
    await settle()

    expect(build).toHaveBeenCalledOnce()
    expect(build.mock.calls[0][0]).toMatchObject({ doc: made.doc, room: 'friday-show', url: 'wss://relay.test', token: 'abc' })
  })

  it('reports connected once the provider is built', async () => {
    const name = `up-${Math.random()}`
    const seen = watch(name)
    const made = host({ name, sync: { connect: () => ({ destroy() {} }) } })

    await made.started
    await settle()

    expect(made.sync.state).toBe(CONNECTED)
    expect(seen.filter((message) => message.type === 'sync').map((message) => message.state)).toEqual([CONNECTING, CONNECTED])
  })

  it('lets a provider report its own state instead', async () => {
    // y-websocket and friends know when they are actually connected; a provider
    // that says so must not be overridden by the seam guessing.
    let report = null
    const made = host({
      name: `reporting-${Math.random()}`,
      sync: {
        connect: (context) => {
          report = context.report
          context.report(CONNECTING)
          return { destroy() {} }
        },
      },
    })

    await made.started
    await settle()

    expect(made.sync.state).toBe(CONNECTING)

    report(CONNECTED)
    expect(made.sync.state).toBe(CONNECTED)
  })

  it('stays local-only when the provider throws, rather than taking the show down', async () => {
    const noise = vi.spyOn(console, 'error').mockImplementation(() => {})
    const made = host({
      name: `broken-${Math.random()}`,
      sync: {
        connect: () => {
          throw new Error('relay unreachable')
        },
      },
    })

    await made.started
    await settle()

    expect(made.sync.state).toBe(ERROR)

    // The host is still a working store. This is the local-first promise: a relay
    // that will not connect costs collaboration, never the broadcast.
    const { port } = client(made)

    port.postMessage({ type: 'mutate', name: 'set', payload: { 'variables.home.score': 3 } })
    await settle()

    expect(made.doc.getMap('state').get('variables.home.score')).toBe(3)

    noise.mockRestore()
  })

  it('does not connect on its own when autoConnect is off', async () => {
    const build = vi.fn(() => ({ destroy() {} }))
    const made = host({ name: `manual-${Math.random()}`, sync: { connect: build, autoConnect: false } })

    await made.started
    await settle()

    expect(build).not.toHaveBeenCalled()

    await made.sync.attach()
    expect(build).toHaveBeenCalledOnce()
  })
})

describe('a remote update', () => {
  it('reaches a subscriber without the host knowing where it came from', async () => {
    // The seam needs no publishing code of its own. A provider applying a remote
    // update produces an ordinary Yjs transaction, and the host's existing
    // observers turn that into a publish -- which is the point of attaching to the
    // doc rather than to the mutation path.
    const name = `remote-${Math.random()}`
    const made = host({ name, sync: { connect: () => ({ destroy() {} }) } })
    const { port } = client(made)

    const heard = []
    const channel = new BroadcastChannel(channelFor(name, 'variables.home.name'))

    channel.onmessage = ({ data }) => heard.push(data.value)
    live.push({ close: () => channel.close() })

    await made.started
    port.postMessage({ type: 'subscribe', path: 'variables.home.name' })
    await settle()

    // Somewhere else entirely: another peer's document, merged in.
    const elsewhere = new Y.Doc()

    elsewhere.getMap('state').set('variables.home.name', 'Vanguard')
    Y.applyUpdate(made.doc, Y.encodeStateAsUpdate(elsewhere))

    await settle()

    expect(heard).toEqual(['Vanguard'])
  })
})

describe('detaching', () => {
  it('destroys the provider and goes back to offline', async () => {
    const destroy = vi.fn()
    const made = host({ name: `down-${Math.random()}`, sync: { connect: () => ({ destroy }) } })

    await made.started
    await settle()
    await made.sync.detach()

    expect(destroy).toHaveBeenCalledOnce()
    expect(made.sync.state).toBe(OFFLINE)
  })

  it('leaves every subscription intact', async () => {
    // The requirement that makes this seam usable mid-show: an operator's relay
    // dropping, or being pointed at a different room, must not cost them the
    // graphics they are already driving.
    const name = `kept-${Math.random()}`
    const made = host({ name, sync: { connect: () => ({ destroy() {} }) } })
    const { port } = client(made)

    const heard = []
    const channel = new BroadcastChannel(channelFor(name, 'variables.home.score'))

    channel.onmessage = ({ data }) => heard.push(data.value)
    live.push({ close: () => channel.close() })

    await made.started
    port.postMessage({ type: 'subscribe', path: 'variables.home.score' })
    await settle()

    const before = made.subscriptions.size

    await made.sync.detach()
    await made.sync.attach()
    await made.sync.detach()
    await settle()

    expect(made.subscriptions.size).toBe(before)

    port.postMessage({ type: 'mutate', name: 'set', payload: { 'variables.home.score': 7 } })
    await settle()

    expect(heard).toEqual([7])
  })

  it('survives a provider that throws on the way out', async () => {
    const noise = vi.spyOn(console, 'error').mockImplementation(() => {})
    const made = host({
      name: `messy-${Math.random()}`,
      sync: {
        connect: () => ({
          destroy() {
            throw new Error('socket already gone')
          },
        }),
      },
    })

    await made.started
    await settle()
    await made.sync.detach()

    expect(made.sync.state).toBe(OFFLINE)
    noise.mockRestore()
  })

  it('is safe to call when nothing is attached', async () => {
    const made = host({ name: `nothing-${Math.random()}` })

    await made.started
    await expect(made.sync.detach()).resolves.toBeUndefined()
  })
})

describe('presence', () => {
  /** A provider that carries an awareness, the way a real one does. */
  const withAwareness = () => {
    const listeners = new Set()
    const states = new Map()

    return {
      clientID: 1,
      getStates: () => states,
      states,
      setLocalState(state) {
        if (state === null) states.delete(1)
        else states.set(1, state)
        this.fire()
      },
      on: (_event, fn) => listeners.add(fn),
      off: (_event, fn) => listeners.delete(fn),
      fire: () => listeners.forEach((fn) => fn()),
    }
  }

  it('reports the operator at this board even with nothing attached', async () => {
    // A studio with no relay still has somebody sitting at it. Presence is not
    // only a network feature -- a board should be able to say "you" regardless.
    const made = host({ name: `alone-${Math.random()}` })

    await made.started
    made.sync.present({ name: 'Dez' })

    expect(made.sync.peers()).toEqual([{ id: 'local', self: true, name: 'Dez' }])
  })

  it('says nothing at all when nobody has introduced themselves', async () => {
    const made = host({ name: `anon-${Math.random()}` })

    await made.started

    expect(made.sync.peers()).toEqual([])
  })

  it('hands the provider whatever was set before it connected', async () => {
    // The ordering that matters: an operator types their name while the relay is
    // still coming up. Losing it to the connection would be a small bug with an
    // irritating shape -- their name appears to everyone except at the moment they
    // set it.
    const awareness = withAwareness()
    const made = host({
      name: `early-${Math.random()}`,
      sync: { autoConnect: false, connect: () => ({ awareness, destroy() {} }) },
    })

    await made.started
    made.sync.present({ name: 'Dez' })
    await made.sync.attach()

    expect(awareness.states.get(1)).toEqual({ name: 'Dez' })
  })

  it('re-applies it after a reconnect', async () => {
    const first = withAwareness()
    const second = withAwareness()
    let next = first
    const made = host({
      name: `again-${Math.random()}`,
      sync: { autoConnect: false, connect: () => ({ awareness: next, destroy() {} }) },
    })

    await made.started
    made.sync.present({ name: 'Dez' })
    await made.sync.attach()

    next = second
    await made.sync.attach()

    expect(second.states.get(1)).toEqual({ name: 'Dez' })
  })

  it('merges patches rather than replacing the whole state', async () => {
    // Two callers own different halves: the operator control sets a name, the draft
    // sets which paths are open. Neither should be able to erase the other.
    const made = host({ name: `merge-${Math.random()}` })

    await made.started
    made.sync.present({ name: 'Dez' })
    made.sync.present({ editing: ['variables.home.name'] })

    expect(made.sync.peers()[0]).toMatchObject({ name: 'Dez', editing: ['variables.home.name'] })
  })

  it('drops a field set back to undefined', async () => {
    const made = host({ name: `drop-${Math.random()}` })

    await made.started
    made.sync.present({ name: 'Dez' })
    made.sync.present({ name: undefined })

    expect(made.sync.peers()).toEqual([])
  })

  it('tells watchers, and stops when they leave', async () => {
    const made = host({ name: `watched-${Math.random()}` })
    const seen = []

    await made.started

    const stop = made.sync.watch((peers) => seen.push(peers.length))

    made.sync.present({ name: 'Dez' })
    stop()
    made.sync.present({ name: 'Sam' })

    expect(seen).toEqual([0, 1])
  })

  it('reaches a client over the status channel', async () => {
    const name = `broadcast-${Math.random()}`
    const seen = watch(name)
    const made = host({ name })

    await made.started
    made.sync.present({ name: 'Dez' })
    await settle()

    expect(seen.find((message) => message.type === 'presence')?.peers).toEqual([{ id: 'local', self: true, name: 'Dez' }])
  })

  it('answers a port that asks, for a board opened after the fact', async () => {
    const made = host({ name: `late-${Math.random()}` })
    const { port, seen } = client(made)

    await made.started
    made.sync.present({ name: 'Dez' })
    await settle()

    port.postMessage({ type: 'sync:status' })
    await settle()

    expect(seen.find((message) => message.type === 'presence')?.peers).toEqual([{ id: 'local', self: true, name: 'Dez' }])
  })
})

describe('re-attaching', () => {
  it('replaces the old provider rather than stacking a second one', async () => {
    const destroy = vi.fn()
    const build = vi.fn(() => ({ destroy }))
    const made = host({ name: `swap-${Math.random()}`, sync: { connect: build } })

    await made.started
    await settle()
    await made.sync.attach()

    expect(destroy).toHaveBeenCalledOnce()
    expect(build).toHaveBeenCalledTimes(2)
    expect(made.sync.state).toBe(CONNECTED)
  })

  it('does not carry a token to a different relay', async () => {
    // A credential for one room is not a credential for another, and sending it to
    // a different host is handing it to a stranger.
    const build = vi.fn(() => ({ destroy() {} }))
    const made = host({ name: `elsewhere-${Math.random()}`, sync: { connect: build, url: 'wss://one.test', token: 'secret' } })

    await made.started
    await settle()
    await made.sync.attach({ url: 'wss://two.test' })

    expect(build.mock.calls.at(-1)[0]).toMatchObject({ url: 'wss://two.test', token: undefined })
  })

  it('keeps the token when only the room changes', async () => {
    const build = vi.fn(() => ({ destroy() {} }))
    const made = host({ name: `same-${Math.random()}`, sync: { connect: build, url: 'wss://one.test', token: 'secret' } })

    await made.started
    await settle()
    await made.sync.attach({ room: 'saturday' })

    expect(build.mock.calls.at(-1)[0]).toMatchObject({ room: 'saturday', token: 'secret' })
  })

  it('can be pointed at a different room mid-session', async () => {
    const build = vi.fn(() => ({ destroy() {} }))
    const made = host({ name: `moved-${Math.random()}`, sync: { connect: build, room: 'first' } })

    await made.started
    await settle()
    await made.sync.attach({ room: 'second' })

    expect(build.mock.calls.at(-1)[0]).toMatchObject({ room: 'second' })

    // The snapshot reports the room we are *in*, not the one the build named. A
    // board joins rooms it was never configured for -- that is the whole point of
    // an invite link -- and the indicator, the token API's address and the links
    // the board hands out all read this.
    expect(made.sync.snapshot.room).toBe('second')
  })

  it('does not install a connection over a detach that landed while the old one was closing', async () => {
    // The narrow window, and the reason a generation is claimed before the first
    // await rather than after the teardown: a detach arriving while an attach is
    // still shutting the previous provider down. Capture the generation afterwards
    // and the attach reads a number the detach has already moved past, decides it
    // is current, and installs a live connection over a deliberate disconnect.
    let releaseDestroy = null
    const build = vi.fn(() => ({ destroy: () => new Promise((resolve) => (releaseDestroy = resolve)) }))
    const made = host({ name: `closing-${Math.random()}`, sync: { autoConnect: false, connect: build } })

    await made.started
    await made.sync.attach()
    expect(made.sync.state).toBe(CONNECTED)

    // Parked inside teardown, waiting on the slow destroy.
    const second = made.sync.attach()

    await settle()

    // The operator changes their mind while that is still unwinding.
    const off = made.sync.detach()

    releaseDestroy()
    await Promise.all([second, off])
    await settle()

    expect(build).toHaveBeenCalledOnce()
    expect(made.sync.state).toBe(OFFLINE)
  })

  it('throws away a slow connect that lands after a detach', async () => {
    // The race worth pinning: attach, change your mind, and the first provider
    // finally resolves. Without the generation check it would install itself over
    // a deliberate detach and leave a live connection nobody is holding.
    const destroy = vi.fn()
    let release = null
    const made = host({
      name: `slow-${Math.random()}`,
      sync: {
        autoConnect: false,
        connect: () => new Promise((resolve) => (release = () => resolve({ destroy }))),
      },
    })

    await made.started

    const attaching = made.sync.attach()

    // Let the connect actually start before changing our mind about it -- the race
    // being pinned is a detach landing mid-connect, not one landing before it.
    await settle()
    expect(made.sync.state).toBe(CONNECTING)

    await made.sync.detach()
    release()
    await attaching
    await settle()

    expect(destroy).toHaveBeenCalledOnce()
    expect(made.sync.state).toBe(OFFLINE)
  })
})

describe('collections', () => {
  // State that is a *set* rather than a value: a library of images, a roster. One
  // path per member is the only conflict-free shape, so the store has to be able to
  // hand back everything under a namespace.
  const collection = async (made, prefix, name) => {
    const { port, seen } = client(made)
    // Both transports, because the host uses both: the opening value comes back
    // down the asking port, and every change after it goes over the channel. A
    // helper watching only one of them tests half the thing.
    const channel = new BroadcastChannel(channelFor(name, `${prefix}.*`))

    channel.onmessage = ({ data }) => seen.push({ type: 'value', ...data })
    live.push({ close: () => channel.close() })

    await made.started
    port.postMessage({ type: 'subscribe', path: `${prefix}.*` })
    await settle()

    return {
      port,
      latest: () => [...seen].reverse().find((message) => message.type === 'value' && message.path === `${prefix}.*`)?.value,
    }
  }

  it('opens with everything already under the namespace', async () => {
    const name = `open-${Math.random()}`
    const made = host({ name })

    await made.started
    made.doc.getMap('state').set('assets.logo', { kind: 'url' })
    made.doc.getMap('state').set('assets.players/ada', { kind: 'file' })
    made.doc.getMap('state').set('variables.home.name', 'Vanguard')

    const watched = await collection(made, 'assets', name)

    expect(watched.latest()).toEqual({ logo: { kind: 'url' }, 'players/ada': { kind: 'file' } })
  })

  it('leaves out everything that is not under it', async () => {
    const name = `apart-${Math.random()}`
    const made = host({ name })
    const watched = await collection(made, 'assets', name)

    made.doc.getMap('state').set('variables.home.name', 'Vanguard')
    await settle()

    expect(watched.latest()).toEqual({})
  })

  it('republishes when a member is added, changed or removed', async () => {
    const name = `moving-${Math.random()}`
    const made = host({ name })
    const watched = await collection(made, 'assets', name)

    made.doc.getMap('state').set('assets.logo', { kind: 'url', url: 'a' })
    await settle()
    expect(watched.latest()).toEqual({ logo: { kind: 'url', url: 'a' } })

    made.doc.getMap('state').set('assets.logo', { kind: 'url', url: 'b' })
    await settle()
    expect(watched.latest()).toEqual({ logo: { kind: 'url', url: 'b' } })

    made.doc.getMap('state').delete('assets.logo')
    await settle()
    expect(watched.latest()).toEqual({})
  })

  it('does not wake a collection for a change outside it', async () => {
    // The reason subscriptions are per-path at all. A board watching a library must
    // not re-render every time the shot clock moves.
    const made = host({ name: `quiet-${Math.random()}` })
    const { port, seen } = client(made)

    await made.started
    port.postMessage({ type: 'subscribe', path: 'assets.*' })
    await settle()

    const before = seen.filter((message) => message.path === 'assets.*').length

    made.doc.getMap('state').set('variables.home.score', 3)
    await settle()

    expect(seen.filter((message) => message.path === 'assets.*').length).toBe(before)
  })

  it('keeps two members added at once, rather than losing one', async () => {
    // The whole reason for a path per member. Under a single path holding the
    // collection, two operators each adding an image inside the replication window
    // means one of them silently loses theirs -- the same failure the counter design
    // exists to prevent, in a different costume.
    const a = Doc.createDoc()
    const b = Doc.createDoc()

    a.getMap('state').set('assets.ada', { kind: 'file' })
    b.getMap('state').set('assets.kim', { kind: 'file' })

    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))

    expect(Doc.collect(a, 'assets')).toEqual({ ada: { kind: 'file' }, kim: { kind: 'file' } })
    expect(Doc.collect(b, 'assets')).toEqual(Doc.collect(a, 'assets'))
  })
})
