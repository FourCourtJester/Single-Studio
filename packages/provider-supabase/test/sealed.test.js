import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'

import { createCipher, isSealed, newSecret } from '../../core/src/velcro/crypto.js'
import { createMeshProvider } from '../src/mesh.js'
import { createSealedWire } from '../src/sealed.js'

// The mesh, run through a real cipher, over a channel that records everything it
// carries. What is being tested is not the crypto -- that has its own suite in core
// -- but the thing an operator is actually promised: two boards agree on the show,
// and what went over the wire between them is unreadable.
//
// Deliberately the same wiring `connectSupabase` uses, with Supabase itself
// replaced by an array. The transport is the fake; the conversation is real.

const secret = newSecret()

/** One sealed room, plus everything the channel saw. */
function room({ key = secret } = {}) {
  const peers = []
  const wire = []

  const join = (label, { holds = key } = {}) => {
    const doc = new Y.Doc()
    const cipher = holds ? createCipher(holds) : null
    const complaints = []

    const peer = {
      doc,
      label,
      complaints,
      read: (path) => doc.getMap('state').get(path),
      set: (path, value) => doc.getMap('state').set(path, value),
    }

    // The shipping wire, not a copy of it written to agree with these tests. Only
    // Supabase itself is replaced -- by an array that keeps everything it carried,
    // which is what makes "nothing readable left this machine" checkable at all.
    peer.wire = createSealedWire({
      seal: cipher?.seal,
      open: cipher?.open,
      isSealed,
      name: label,
      report: (_state, why) => complaints.push(why),
      toTransport: (bytes) => {
        wire.push(bytes)

        for (const other of peers) {
          if (other !== peer) other.wire.receive(bytes)
        }
      },
      toMesh: (bytes) => peer.mesh.receive(bytes),
    })

    peer.mesh = createMeshProvider({ doc, name: label, send: peer.wire.send })

    peer.mesh.connected()
    peers.push(peer)

    return peer
  }

  return { join, wire, settle: () => new Promise((resolve) => setTimeout(resolve, 30)) }
}

/** The complaints are sentences meant for an operator, so match on what they say. */
const said = (peer, fragment) => peer.complaints.some((why) => why?.toLowerCase().includes(fragment))

describe('a sealed room', () => {
  it('still converges, in both directions', async () => {
    const show = room()
    const host = show.join('host')
    const operator = show.join('operator')

    host.mesh.greet()
    operator.mesh.greet()
    await show.settle()

    host.set('variables.home.name', 'Vanguard')
    await show.settle()

    expect(operator.read('variables.home.name')).toBe('Vanguard')

    operator.set('variables.home.score', 12)
    await show.settle()

    expect(host.read('variables.home.score')).toBe(12)
  })

  it('puts nothing readable on the wire', async () => {
    // The promise, as an assertion. Searched as bytes rather than as text, because
    // a partial encoding leaking a guest's name would still slip past a string
    // comparison on the whole frame.
    const show = room()
    const host = show.join('host')

    show.join('operator')
    host.mesh.greet()
    host.set('variables.guest.name', 'Ada Okafor')
    await show.settle()

    expect(show.wire.length).toBeGreaterThan(0)

    const needle = new TextEncoder().encode('Ada Okafor')
    const leaked = show.wire.some((frame) => [...frame].some((_, at) => needle.every((byte, i) => frame[at + i] === byte)))

    expect(leaked).toBe(false)
    expect(show.wire.every((frame) => isSealed(frame))).toBe(true)
  })

  it('carries the operator list sealed as well as the show', async () => {
    // Presence is not metadata to be shrugged at: it carries operator names and
    // which field each of them has open. It rides the same byte path, which is the
    // reason sealing that path covers it without a second mechanism.
    const show = room()
    const host = show.join('host')

    show.join('operator')
    host.mesh.awareness.setLocalState({ name: 'Dez', editing: ['variables.guest.name'] })
    await show.settle()

    const needle = new TextEncoder().encode('Dez')
    const leaked = show.wire.some((frame) => [...frame].some((_, at) => needle.every((byte, i) => frame[at + i] === byte)))

    expect(leaked).toBe(false)
  })
})

describe('a machine with the wrong key, or none', () => {
  it('cannot read the show', async () => {
    const show = room()
    const host = show.join('host')
    const stranger = show.join('stranger', { holds: newSecret() })

    host.mesh.greet()
    host.set('variables.home.name', 'Vanguard')
    await show.settle()

    expect(stranger.read('variables.home.name')).toBeUndefined()
    expect(said(stranger, 'wrong key')).toBe(true)
  })

  it('cannot write to it either', async () => {
    // Sealing authenticates as well as encrypts, so guessing the room name is no
    // longer enough to change what goes to air. Without this, encryption would
    // protect the show from being read and leave it wide open to being edited.
    const show = room()
    const host = show.join('host')
    const stranger = show.join('stranger', { holds: newSecret() })

    stranger.set('variables.home.name', 'Defaced')
    await show.settle()

    expect(host.read('variables.home.name')).toBeUndefined()
    expect(said(host, 'wrong key')).toBe(true)
  })

  it('is refused rather than quietly let in when it speaks in the clear', async () => {
    // The failure this exists to prevent is the silent one. A peer with no key at
    // all still produces well-formed mesh frames; applying them would leave a room
    // that works perfectly, that everybody believes is sealed, and that is not.
    const show = room()
    const host = show.join('host')
    const plain = show.join('plain', { holds: null })

    plain.set('variables.home.name', 'Downgrade')
    await show.settle()

    expect(host.read('variables.home.name')).toBeUndefined()
    expect(said(host, 'without the key')).toBe(true)
  })

  it('is told plainly when it is the one without a key', async () => {
    // The opposite mistake, and the common one: an old link for a show that has
    // since been sealed. A board that sat there looking connected and empty would
    // send somebody hunting for a bug instead of asking for a new link.
    const show = room()
    const host = show.join('host')
    const plain = show.join('plain', { holds: null })

    host.mesh.greet()
    host.set('variables.home.name', 'Vanguard')
    await show.settle()

    expect(plain.read('variables.home.name')).toBeUndefined()
    expect(said(plain, 'encrypted and this link has no key')).toBe(true)
  })
})

describe('an unsealed room', () => {
  it('behaves exactly as it did before any of this existed', async () => {
    const show = room({ key: null })
    const host = show.join('host', { holds: null })
    const operator = show.join('operator', { holds: null })

    host.mesh.greet()
    host.set('variables.home.name', 'Vanguard')
    await show.settle()

    expect(operator.read('variables.home.name')).toBe('Vanguard')
    expect(show.wire.every((frame) => !isSealed(frame))).toBe(true)
    expect(host.complaints).toEqual([])
  })
})
