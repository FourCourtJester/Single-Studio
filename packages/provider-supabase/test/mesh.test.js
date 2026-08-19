import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'

import { createMeshProvider } from '../src/mesh.js'

// A mesh has no server to be right, so the interesting behaviour is entirely in
// how peers answer each other. These wire real Yjs documents together through a
// fake channel: the transport is the fake, never the conversation.

/** Every peer hears every message except its own, which is what a broadcast is. */
function room() {
  const peers = []

  const join = (label) => {
    const doc = new Y.Doc()
    const peer = {
      doc,
      label,
      read: (key) => doc.getMap('state').get(key),
      set: (key, value) => doc.getMap('state').set(key, value),
    }

    peer.mesh = createMeshProvider({
      doc,
      name: label,
      send: (bytes) => {
        for (const other of peers) {
          if (other !== peer) other.mesh.receive(bytes)
        }
      },
    })

    peers.push(peer)

    return peer
  }

  return { join, peers, greet: () => peers.forEach((peer) => peer.mesh.greet()) }
}

describe('a peer that leaves', () => {
  // Awareness drops a stale state after thirty seconds, which is a backstop for a
  // peer that vanished, not a way to notice one that left. A mesh has no server to
  // see a closed socket, so an operator count climbed on every reload and took half
  // a minute to come back down -- the room being visibly wrong about who is in it.

  it('goes from the room at once, not in thirty seconds', () => {
    const show = room()
    const host = show.join('host')
    const guest = show.join('guest')

    host.mesh.connected()
    guest.mesh.connected()
    host.mesh.awareness.setLocalState({ name: 'Dez' })
    guest.mesh.awareness.setLocalState({ name: 'Sam' })

    expect(host.mesh.awareness.getStates().size).toBe(2)

    // What the transport hands back is the departing peer's own client id.
    host.mesh.forget([guest.doc.clientID])

    expect(host.mesh.awareness.getStates().size).toBe(1)
    expect([...host.mesh.awareness.getStates().values()].map((state) => state.name)).toEqual(['Dez'])
  })

  it('takes the string a transport actually hands over', () => {
    // Supabase presence keys are strings; the client ids they stand for are not.
    const show = room()
    const host = show.join('host')
    const guest = show.join('guest')

    host.mesh.connected()
    guest.mesh.connected()
    host.mesh.awareness.setLocalState({ name: 'Dez' })
    guest.mesh.awareness.setLocalState({ name: 'Sam' })

    host.mesh.forget([String(guest.doc.clientID)])

    expect(host.mesh.awareness.getStates().size).toBe(1)
  })

  it('never forgets itself, whatever it is told', () => {
    const show = room()
    const host = show.join('host')

    host.mesh.connected()
    host.mesh.awareness.setLocalState({ name: 'Dez' })
    host.mesh.forget([host.doc.clientID, 'nonsense', undefined, null])

    expect(host.mesh.awareness.getStates().get(host.doc.clientID)).toEqual({ name: 'Dez' })
  })
})

describe('a transport that will not take a message', () => {
  // Supabase answers a broadcast with a status rather than throwing, so a refused
  // send resolves like a successful one and a `try` around it catches nothing. The
  // cost of missing that is not noise in a log: the peers quietly diverge and the
  // board goes on saying "connected".

  it('notices a send that fails after the call returned', async () => {
    const noise = vi.spyOn(console, 'error').mockImplementation(() => {})
    const told = []
    const doc = new Y.Doc()
    const mesh = createMeshProvider({
      doc,
      name: 'flaky',
      report: (state, why) => told.push([state, why]),
      send: () => Promise.reject(new Error('rate limited')),
    })

    mesh.connected()
    doc.getMap('state').set('variables.home.name', 'Vanguard')

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(told.some(([state]) => state === 'error')).toBe(true)

    noise.mockRestore()
  })

  it('notices one that throws outright', async () => {
    const noise = vi.spyOn(console, 'error').mockImplementation(() => {})
    const told = []
    const doc = new Y.Doc()
    const mesh = createMeshProvider({
      doc,
      name: 'broken',
      report: (state, why) => told.push([state, why]),
      send: () => {
        throw new Error('socket is gone')
      },
    })

    mesh.connected()
    doc.getMap('state').set('variables.home.name', 'Vanguard')

    expect(told.some(([state]) => state === 'error')).toBe(true)

    noise.mockRestore()
  })

  it('says nothing when the transport is happy', async () => {
    const told = []
    const doc = new Y.Doc()
    const mesh = createMeshProvider({ doc, name: 'fine', report: (state) => told.push(state), send: () => Promise.resolve('ok') })

    mesh.connected()
    doc.getMap('state').set('variables.home.name', 'Vanguard')

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(told.filter((state) => state === 'error')).toEqual([])
  })
})

describe('two peers', () => {
  it('converge on an edit', () => {
    const show = room()
    const host = show.join('host')
    const operator = show.join('operator')

    host.mesh.connected()
    operator.mesh.connected()

    host.set('variables.home.name', 'Vanguard')

    expect(operator.read('variables.home.name')).toBe('Vanguard')
  })

  it('converge when one replaces what the other set', () => {
    // The shape that broke everything the first time: a Y.Map set is a delete plus
    // an insert, so it only lands if the peer holds what the insert depends on.
    const show = room()
    const host = show.join('host')
    const operator = show.join('operator')

    host.mesh.connected()
    operator.mesh.connected()

    host.set('variables.home.name', 'Vanguard')
    operator.set('variables.home.name', 'Redline')

    expect(host.read('variables.home.name')).toBe('Redline')
    expect(operator.read('variables.home.name')).toBe('Redline')
  })

  it('do not answer each other forever', () => {
    // Every peer replies to every sync message, so a reply that looks like a local
    // edit is a loop. The origin on readSyncMessage is what stops it.
    const show = room()
    const host = show.join('host')

    host.mesh.connected()
    host.set('variables.home.name', 'Vanguard')

    const operator = show.join('operator')
    const sent = vi.fn()
    const original = operator.mesh.receive

    operator.mesh.connected()

    let messages = 0
    const count = () => (messages += 1)

    operator.mesh.receive = (bytes) => {
      count()
      original(bytes)
    }

    host.mesh.greet()

    expect(messages).toBeLessThan(10)
    expect(sent).not.toHaveBeenCalled()
  })
})

describe('a peer that arrives late', () => {
  it('is given the show by whoever is already here', () => {
    const show = room()
    const host = show.join('host')

    host.mesh.connected()
    host.set('variables.home.name', 'Vanguard')
    host.set('variables.period', 'Game 2')

    const operator = show.join('operator')

    operator.mesh.connected()

    expect(operator.read('variables.home.name')).toBe('Vanguard')
    expect(operator.read('variables.period')).toBe('Game 2')
  })

  it('is caught up by a greeting even if its own hello was missed', () => {
    // A transport connects asynchronously, so a peer's opening message can land
    // before anyone is listening. The presence join event covers it.
    const show = room()
    const host = show.join('host')

    host.mesh.connected()
    host.set('variables.home.name', 'Vanguard')

    const operator = show.join('operator')

    // Deliberately does not say hello.
    operator.mesh.connected = () => {}

    expect(operator.read('variables.home.name')).toBeUndefined()

    host.mesh.greet()

    expect(operator.read('variables.home.name')).toBe('Vanguard')
  })
})

describe('three peers', () => {
  it('all end up with the same show', () => {
    const show = room()
    const host = show.join('host')
    const a = show.join('a')
    const b = show.join('b')

    for (const peer of [host, a, b]) peer.mesh.connected()

    host.set('variables.home.name', 'Vanguard')
    a.set('variables.away.name', 'Redline')
    b.set('variables.period', 'Game 2')

    for (const peer of [host, a, b]) {
      expect(peer.read('variables.home.name')).toBe('Vanguard')
      expect(peer.read('variables.away.name')).toBe('Redline')
      expect(peer.read('variables.period')).toBe('Game 2')
    }
  })

  it('add concurrent increments up rather than losing one', () => {
    // The regression the whole store exists to prevent, with no server anywhere.
    const show = room()
    const host = show.join('host')
    const operator = show.join('operator')

    host.mesh.connected()
    operator.mesh.connected()

    host.doc.getMap('deltas').set(`${host.doc.clientID}:variables.home.score`, 1)
    operator.doc.getMap('deltas').set(`${operator.doc.clientID}:variables.home.score`, 1)

    const total = (peer) => [...peer.doc.getMap('deltas').values()].reduce((sum, value) => sum + value, 0)

    expect(total(host)).toBe(2)
    expect(total(operator)).toBe(2)
  })
})

describe('presence', () => {
  it('reaches the other peers', () => {
    const show = room()
    const host = show.join('host')
    const operator = show.join('operator')

    host.mesh.connected()
    operator.mesh.connected()

    host.mesh.awareness.setLocalState({ name: 'Dez' })

    expect([...operator.mesh.awareness.getStates().values()]).toContainEqual({ name: 'Dez' })
  })

  it('goes with a peer that leaves', () => {
    const show = room()
    const host = show.join('host')
    const operator = show.join('operator')

    host.mesh.connected()
    operator.mesh.connected()
    host.mesh.awareness.setLocalState({ name: 'Dez' })

    expect(operator.mesh.awareness.getStates().size).toBe(1)

    host.mesh.destroy()

    expect(operator.mesh.awareness.getStates().size).toBe(0)
  })
})

describe('a broken channel', () => {
  it('does not send before the transport is up', () => {
    const sends = []
    const doc = new Y.Doc()
    const mesh = createMeshProvider({ doc, name: 'early', send: (bytes) => sends.push(bytes) })

    doc.getMap('state').set('variables.home.name', 'Vanguard')

    expect(sends).toHaveLength(0)

    mesh.connected()

    expect(sends.length).toBeGreaterThan(0)
  })

  it('survives a send that throws', () => {
    const noise = vi.spyOn(console, 'error').mockImplementation(() => {})
    const doc = new Y.Doc()
    const mesh = createMeshProvider({
      doc,
      name: 'broken',
      send: () => {
        throw new Error('socket closed')
      },
    })

    mesh.connected()

    // The document is still a document.
    expect(() => doc.getMap('state').set('variables.home.name', 'Vanguard')).not.toThrow()
    expect(doc.getMap('state').get('variables.home.name')).toBe('Vanguard')
    noise.mockRestore()
  })

  it('survives a peer sending nonsense', () => {
    const noise = vi.spyOn(console, 'error').mockImplementation(() => {})
    const show = room()
    const host = show.join('host')
    const operator = show.join('operator')

    host.mesh.connected()
    operator.mesh.connected()

    operator.mesh.receive(new Uint8Array([0, 255, 255, 255, 255]))

    host.set('variables.home.name', 'Vanguard')

    expect(operator.read('variables.home.name')).toBe('Vanguard')
    noise.mockRestore()
  })

  it('stops touching the document once destroyed', () => {
    const sends = []
    const doc = new Y.Doc()
    const mesh = createMeshProvider({ doc, name: 'gone', send: (bytes) => sends.push(bytes) })

    mesh.connected()
    sends.length = 0
    mesh.destroy()

    doc.getMap('state').set('variables.home.name', 'Vanguard')

    expect(sends).toHaveLength(0)
  })
})
