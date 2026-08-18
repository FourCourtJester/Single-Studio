import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as syncProtocol from 'y-protocols/sync'
import { describe, expect, it, vi } from 'vitest'

import { createRoom } from '../src/room.js'
import { AWARENESS, SYNC } from '../src/protocol.js'

// A room is transport-agnostic, so these are real peers with a fake wire. Every
// message that crosses is the same protocol a browser would speak -- the fake is
// the socket, never the conversation.

/**
 * One peer, holding its own Y.Doc, talking the y-websocket protocol.
 *
 * Deliberately not a mock of the client library: a mock that agrees with the
 * server about a protocol neither of them implements proves nothing. This drives
 * y-protocols directly, which is what the browser does.
 */
function peer(name = 'peer') {
  const doc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(doc)
  const sent = []
  let handle = null

  // Quiet until it has something to say, so presence counts mean what they read as.
  awareness.setLocalState(null)

  const socket = {
    name,
    send: (bytes) => sent.push(bytes),
    close: vi.fn(),
  }

  const deliver = () => {
    // Drain rather than iterate: handling one message can produce more.
    while (sent.length) {
      const message = sent.shift()
      const decoder = decoding.createDecoder(message)
      const type = decoding.readVarUint(decoder)

      if (type === SYNC) {
        const encoder = encoding.createEncoder()

        encoding.writeVarUint(encoder, SYNC)
        syncProtocol.readSyncMessage(decoder, encoder, doc, 'relay')

        if (encoding.length(encoder) > 1) handle.message(encoding.toUint8Array(encoder))
      }

      if (type === AWARENESS) awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), 'relay')
    }
  }

  return {
    doc,
    awareness,
    socket,

    async join(room) {
      handle = room.join(socket)

      await handle.ready

      // Both ends open with a step1. The room sends one so the peer learns what it
      // is missing; the peer sends one so the room learns the same in reverse.
      // Only answering the room's -- which is the tempting shortcut -- means a
      // joiner tells the room everything and is told nothing, so a late joiner
      // silently gets an empty show.
      const encoder = encoding.createEncoder()

      encoding.writeVarUint(encoder, SYNC)
      syncProtocol.writeSyncStep1(encoder, doc)
      handle.message(encoding.toUint8Array(encoder))

      deliver()

      return this
    },

    /** Change something locally and push it, the way a provider would. */
    push(change) {
      const before = Y.encodeStateVector(doc)

      change(doc)

      const encoder = encoding.createEncoder()

      encoding.writeVarUint(encoder, SYNC)
      syncProtocol.writeUpdate(encoder, Y.encodeStateAsUpdate(doc, before))
      handle.message(encoding.toUint8Array(encoder))
      deliver()
    },

    pushAwareness(state) {
      awareness.setLocalState(state)

      const encoder = encoding.createEncoder()

      encoding.writeVarUint(encoder, AWARENESS)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, [doc.clientID]))
      handle.message(encoding.toUint8Array(encoder))
      deliver()
    },

    settle: deliver,
    close: () => handle.close(),
    read: (key) => doc.getMap('state').get(key),
  }
}

describe('two peers in a room', () => {
  it('shows one operator the edit another just made', async () => {
    const room = createRoom()
    const host = await peer('host').join(room)
    const operator = await peer('operator').join(room)

    host.push((doc) => doc.getMap('state').set('variables.home.name', 'Vanguard'))
    operator.settle()

    expect(operator.read('variables.home.name')).toBe('Vanguard')
  })

  it('does not echo an update back to whoever sent it', async () => {
    // Not merely wasteful. An echo is an update the sender applies to itself, and
    // on a counter that is how a +1 becomes a +2 the operator never asked for.
    const room = createRoom()
    const host = await peer('host').join(room)

    await peer('operator').join(room)

    host.socket.send = vi.fn()
    host.push((doc) => doc.getMap('state').set('variables.home.score', 1))

    expect(host.socket.send).not.toHaveBeenCalled()
  })

  it('adds concurrent increments up rather than losing one', async () => {
    // The regression the whole store design exists to prevent, now proven across
    // the wire rather than only between two docs in a unit test.
    const room = createRoom()
    const host = await peer('host').join(room)
    const operator = await peer('operator').join(room)

    // Both peers write their own subtotal; the read is the sum.
    host.push((doc) => doc.getMap('deltas').set(`${doc.clientID}:variables.home.score`, 1))
    operator.push((doc) => doc.getMap('deltas').set(`${doc.clientID}:variables.home.score`, 1))
    host.settle()
    operator.settle()

    const sum = (which) => [...which.doc.getMap('deltas').entries()].reduce((total, [, value]) => total + value, 0)

    expect(sum(host)).toBe(2)
    expect(sum(operator)).toBe(2)
  })
})

describe('a peer that speaks before the room is ready', () => {
  it('is answered rather than ignored', async () => {
    // The bug this exists for, and it is close to silent. A peer's opening
    // syncStep1 is in flight before any transport can finish attaching, so if the
    // room is not ready to queue it, it is dropped -- and the peer still *receives*
    // broadcasts afterwards, so it looks connected. What it never gets is the state
    // it asked for.
    //
    // A Y.Map set is a delete of the old value plus an insert of the new one. Such
    // a peer can resolve the delete, because it has the old value, but the insert
    // depends on operations it never received, so Yjs parks it as pending. The key
    // does not go stale, it goes *missing*, and stays missing.
    let release = null
    const room = createRoom({ load: () => new Promise((resolve) => (release = () => resolve(null))) })

    // A peer whose whole handshake lands while storage is still loading.
    const doc = new Y.Doc()
    const sent = []
    const handle = room.join({ send: (bytes) => sent.push(bytes), close() {} })

    const encoder = encoding.createEncoder()

    encoding.writeVarUint(encoder, SYNC)
    syncProtocol.writeSyncStep1(encoder, doc)
    handle.message(encoding.toUint8Array(encoder))

    expect(sent).toHaveLength(0)

    release()
    await handle.ready
    await new Promise((resolve) => setTimeout(resolve, 10))

    // The room's own step1, then the answer to the one sent too early.
    expect(sent.length).toBeGreaterThanOrEqual(2)
  })

  it('ends up with the same document as everyone else', async () => {
    let release = null
    const room = createRoom({ load: () => new Promise((resolve) => (release = () => resolve(null))) })
    const early = peer('early')
    const joining = early.join(room)

    release()
    await joining

    const late = await peer('late').join(room)

    late.push((doc) => doc.getMap('state').set('variables.home.name', 'Vanguard'))
    early.settle()

    expect(early.read('variables.home.name')).toBe('Vanguard')

    // And the other way, which is the direction that broke: a set replaces a value
    // the early peer already holds.
    early.push((doc) => doc.getMap('state').set('variables.home.name', 'Redline'))
    late.settle()

    expect(late.read('variables.home.name')).toBe('Redline')
  })
})

describe('a late joiner', () => {
  it('gets the show as it stands, without anyone resending it', async () => {
    const room = createRoom()
    const host = await peer('host').join(room)

    host.push((doc) => doc.getMap('state').set('variables.home.name', 'Vanguard'))
    host.push((doc) => doc.getMap('state').set('variables.away.name', 'Redline'))

    const operator = await peer('operator').join(room)

    expect(operator.read('variables.home.name')).toBe('Vanguard')
    expect(operator.read('variables.away.name')).toBe('Redline')
  })

  it('gets it from storage when nobody else is connected', async () => {
    // The reason the room persists at all: an operator opening their board before
    // the streamer has started OBS should see the show, not an empty board.
    const first = createRoom({ load: () => null })
    const host = await peer('host').join(first)

    host.push((doc) => doc.getMap('state').set('variables.period', 'Game 2'))

    // Take what the room would have written, then take the room away entirely.
    const stored = Y.encodeStateAsUpdate(first.doc)

    host.close()
    await first.destroy()

    const second = createRoom({ load: () => stored })
    const operator = await peer('operator').join(second)

    expect(operator.read('variables.period')).toBe('Game 2')
  })
})

describe('presence', () => {
  it('reaches the other peers in the room', async () => {
    const room = createRoom()
    const host = await peer('host').join(room)
    const operator = await peer('operator').join(room)

    host.pushAwareness({ name: 'Dez' })
    operator.settle()

    expect([...operator.awareness.getStates().values()]).toContainEqual({ name: 'Dez' })
  })

  it('is cleaned up when a peer disconnects', async () => {
    // Otherwise every reload leaves a ghost operator in everyone's list until
    // they reload too.
    const room = createRoom()
    const host = await peer('host').join(room)
    const operator = await peer('operator').join(room)

    host.pushAwareness({ name: 'Dez' })
    operator.settle()
    expect(operator.awareness.getStates().size).toBe(1)

    host.close()
    operator.settle()

    expect(operator.awareness.getStates().size).toBe(0)
  })
})

describe('a room under stress', () => {
  it('survives a peer that sends nonsense', async () => {
    const noise = vi.spyOn(console, 'error').mockImplementation(() => {})
    const room = createRoom()
    const host = await peer('host').join(room)
    const operator = await peer('operator').join(room)
    const handle = room.join({ send() {}, close() {} })

    await handle.ready

    handle.message(new Uint8Array([0, 255, 255, 255, 255]))

    // The room is still a room.
    host.push((doc) => doc.getMap('state').set('variables.home.name', 'Vanguard'))
    operator.settle()

    expect(operator.read('variables.home.name')).toBe('Vanguard')
    noise.mockRestore()
  })

  it('drops a peer whose socket has gone without taking the others with it', async () => {
    const noise = vi.spyOn(console, 'error').mockImplementation(() => {})
    const room = createRoom()
    const host = await peer('host').join(room)
    const operator = await peer('operator').join(room)

    await room.join({
      send() {
        throw new Error('socket closed')
      },
      close() {},
    }).ready

    host.push((doc) => doc.getMap('state').set('variables.home.name', 'Vanguard'))
    operator.settle()

    expect(operator.read('variables.home.name')).toBe('Vanguard')
    expect(room.size).toBe(2)
    noise.mockRestore()
  })

  it('reports when it has emptied, so a host can let it go', async () => {
    const onEmpty = vi.fn()
    const room = createRoom({ onEmpty })
    const host = await peer('host').join(room)
    const operator = await peer('operator').join(room)

    host.close()
    expect(onEmpty).not.toHaveBeenCalled()

    operator.close()
    expect(onEmpty).toHaveBeenCalledOnce()
  })
})

describe('persistence', () => {
  it('coalesces a burst of edits into one write', async () => {
    // Storage is the slowest thing a room touches, and a scoreboard tapped ten
    // times in three seconds is one write, not ten.
    const save = vi.fn()
    const room = createRoom({ save, saveAfter: 30 })
    const host = await peer('host').join(room)

    for (let n = 1; n <= 10; n += 1) host.push((doc) => doc.getMap('state').set('variables.home.score', n))

    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(save).toHaveBeenCalledOnce()
  })

  it('writes once more on the way down, undebounced', async () => {
    // Whatever the last few hundred milliseconds produced is exactly what a crash
    // would otherwise lose.
    const save = vi.fn()
    const room = createRoom({ save, saveAfter: 5_000 })
    const host = await peer('host').join(room)

    host.push((doc) => doc.getMap('state').set('variables.home.score', 3))
    expect(save).not.toHaveBeenCalled()

    await room.destroy()

    expect(save).toHaveBeenCalledOnce()
  })

  it('does not let a peer sync against an empty document while storage is loading', async () => {
    // The failure this prevents is silent and total: a peer that syncs first is
    // told the show is blank, agrees, and the blank wins.
    let release = null
    const stored = (() => {
      const doc = new Y.Doc()

      doc.getMap('state').set('variables.home.name', 'Vanguard')

      return Y.encodeStateAsUpdate(doc)
    })()

    const room = createRoom({ load: () => new Promise((resolve) => (release = () => resolve(stored))) })
    const joining = peer('operator').join(room)

    await new Promise((resolve) => setTimeout(resolve, 20))
    release()

    const operator = await joining

    expect(operator.read('variables.home.name')).toBe('Vanguard')
  })
})
