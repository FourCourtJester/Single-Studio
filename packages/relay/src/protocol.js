import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'

// The y-websocket wire protocol, implemented server-side.
//
// Deliberately the *standard* one rather than something of our own. It means a
// studio can point at this relay, at y-websocket, at Hocuspocus or at y-sweet
// without changing a line, which is the promise made in collaboration.md: the
// endpoint is just a URL. It also means the client half is a library somebody else
// maintains and tests.
//
// Every message is a varUint type followed by that type's payload:
//
//   0  sync       the y-protocols/sync handshake and subsequent updates
//   1  awareness  presence: who is here, and later, who is editing what

export const SYNC = 0
export const AWARENESS = 1

const encoded = (write) => {
  const encoder = encoding.createEncoder()

  write(encoder)

  return encoding.toUint8Array(encoder)
}

/** "Here is what I have; send me what I am missing." Sent to every peer on join. */
export const syncStep1 = (doc) =>
  encoded((encoder) => {
    encoding.writeVarUint(encoder, SYNC)
    syncProtocol.writeSyncStep1(encoder, doc)
  })

/** A document update, addressed to everyone but its author. */
export const syncUpdate = (update) =>
  encoded((encoder) => {
    encoding.writeVarUint(encoder, SYNC)
    syncProtocol.writeUpdate(encoder, update)
  })

/** The presence of some set of clients, as one message. */
export const awarenessUpdate = (awareness, clients) =>
  encoded((encoder) => {
    encoding.writeVarUint(encoder, AWARENESS)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, clients))
  })

/**
 * Handle one message from a peer.
 *
 * Returns a reply to send back to *that* peer, or null. Broadcasting is the
 * room's job: sync replies are point-to-point (they answer what this peer asked
 * for), while the updates everyone needs arrive through the doc's own update
 * event, which fires for remote applications just as it does for local ones.
 */
export function handleMessage({ doc, awareness, peer, message }) {
  const decoder = decoding.createDecoder(message)
  const type = decoding.readVarUint(decoder)

  if (type === SYNC) {
    const encoder = encoding.createEncoder()

    encoding.writeVarUint(encoder, SYNC)
    // `peer` becomes the transaction origin, which is what lets the room send an
    // update to everyone *except* the peer that produced it.
    syncProtocol.readSyncMessage(decoder, encoder, doc, peer)

    // length 1 means the type byte and nothing else: read, nothing to say back.
    return encoding.length(encoder) > 1 ? encoding.toUint8Array(encoder) : null
  }

  if (type === AWARENESS) {
    awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), peer)

    return null
  }

  // An unknown type is not fatal. A newer client talking to an older relay should
  // lose the feature it added, not the connection it needs.
  return null
}
