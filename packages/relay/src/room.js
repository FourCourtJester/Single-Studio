import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'

import { awarenessUpdate, handleMessage, syncStep1, syncUpdate } from './protocol.js'

// One room, one document, n peers. Transport-agnostic on purpose.
//
// A room knows nothing about WebSockets, Durable Objects or Node. It is handed
// peers that can `send(bytes)` and told when bytes arrive, which is what lets the
// same logic run behind `ws` for a self-hosted relay, behind a Durable Object on
// Cloudflare, and behind a pair of fakes in a test. The interesting behaviour --
// convergence, late joiners, presence cleanup -- is then testable without a socket
// anywhere in sight.
//
// The room is NOT authoritative. It holds a replica like everybody else and
// rebroadcasts what it learns. If it dies mid-show every peer keeps rendering from
// its own document; when it comes back, queued edits converge. That is the whole
// reason for a CRDT here rather than a server that owns the truth.

/** How long to wait for edits to stop before writing to storage. */
const SAVE_AFTER = 400

export function createRoom({ name = 'room', load, save, onEmpty, saveAfter = SAVE_AFTER } = {}) {
  const doc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(doc)
  /**
   * peer -> the awareness client ids that peer speaks for.
   *
   * Tracked rather than derived, because there is nowhere to derive it from: an
   * awareness state carries no record of the connection that announced it. Without
   * this a disconnect leaves the operator in everyone else's presence list until
   * they reload -- a ghost in the room.
   */
  const peers = new Map()

  // The relay is not an editing client. Its own awareness slot would show up as a
  // ghost operator in everyone's presence list.
  awareness.setLocalState(null)

  let saveTimer = null
  let destroyed = false

  const loaded = Promise.resolve(load?.()).then((stored) => {
    if (stored && !destroyed) Y.applyUpdate(doc, stored, 'storage')

    return doc
  })

  function persist() {
    if (!save || destroyed) return

    clearTimeout(saveTimer)

    // Coalesced. A scoreboard being tapped ten times in three seconds is one
    // write, not ten, and storage is the slowest thing a room touches.
    saveTimer = setTimeout(() => {
      Promise.resolve(save(Y.encodeStateAsUpdate(doc))).catch((error) => console.error(`[relay] ${name}: could not persist`, error))
    }, saveAfter)
  }

  function broadcast(bytes, except) {
    for (const peer of peers.keys()) {
      if (peer === except) continue

      try {
        peer.send(bytes)
      } catch (error) {
        console.error(`[relay] ${name}: dropping a peer that would not take a message`, error)
        peers.delete(peer)
      }
    }
  }

  doc.on('update', (update, origin) => {
    // `origin` is the peer whose message produced this, so it already has it.
    broadcast(syncUpdate(update), origin)
    persist()
  })

  awareness.on('update', ({ added, updated, removed }, origin) => {
    const owned = peers.get(origin)

    if (owned) {
      for (const client of added) owned.add(client)
      for (const client of removed) owned.delete(client)
    }

    const changed = [...added, ...updated, ...removed]

    if (!changed.length) return

    broadcast(awarenessUpdate(awareness, changed), origin)
  })

  /**
   * Add a peer and open the handshake.
   *
   * Returns synchronously, and that is the whole point. An earlier cut awaited
   * storage before handing back the handle, so a transport could not attach its
   * message listener until after the await -- and a peer's opening syncStep1
   * arrives immediately, well inside that window. Losing it is close to silent: the
   * peer still *receives* broadcasts, so it looks connected, but the relay never
   * answered what it asked for, so it never gets the state it was missing.
   *
   * What that looks like on air is worse than a dead connection. A Y.Map set is a
   * delete of the old value plus an insert of the new one. The peer can resolve the
   * delete, because it has the old value, but the insert depends on operations it
   * never received, so Yjs parks it as pending. The key disappears -- not stale, not
   * wrong, *gone* -- and stays gone, because nothing will ever ask again.
   *
   * So the handle exists from the first tick and queues anything that arrives
   * before the room is ready to answer it.
   */
  function join(peer) {
    const queue = []
    let open = false

    function deliver(bytes) {
      try {
        const reply = handleMessage({ doc, awareness, peer, message: bytes })

        if (reply) peer.send(reply)
      } catch (error) {
        // One malformed frame must not take the room down for everyone else.
        console.error(`[relay] ${name}: bad message from a peer`, error)
      }
    }

    const ready = loaded.then(() => {
      if (destroyed) {
        peer.close?.()
        return
      }

      peers.set(peer, new Set())

      // Guarded like every other send. A socket can die between being accepted and
      // being spoken to, and an exception here would escape the join and take down
      // the connection handler rather than just this peer.
      try {
        peer.send(syncStep1(doc))

        // Whoever is already here, so a joiner's presence list arrives populated
        // rather than filling in one operator at a time as they happen to move.
        const known = [...awareness.getStates().keys()]

        if (known.length) peer.send(awarenessUpdate(awareness, known))
      } catch (error) {
        console.error(`[relay] ${name}: a peer went away before it could be greeted`, error)
        peers.delete(peer)

        return
      }

      open = true

      for (const bytes of queue.splice(0)) deliver(bytes)
    })

    return {
      /** Resolves once storage has loaded and the handshake has been opened. */
      ready,

      message(bytes) {
        if (destroyed) return
        if (open) deliver(bytes)
        else queue.push(bytes)
      },

      close() {
        const owned = peers.get(peer)

        queue.length = 0
        open = false

        if (!peers.delete(peer)) return

        // Their presence goes with them, or every disconnect leaves a ghost in
        // everyone's operator list until the page is reloaded.
        if (owned?.size) awarenessProtocol.removeAwarenessStates(awareness, [...owned], null)

        if (!peers.size) onEmpty?.()
      },
    }
  }

  async function destroy() {
    destroyed = true
    clearTimeout(saveTimer)

    // One last write, undebounced: whatever the room learned in the last few
    // hundred milliseconds is exactly what a crash would otherwise lose.
    if (save) await Promise.resolve(save(Y.encodeStateAsUpdate(doc))).catch(() => {})

    for (const peer of peers.keys()) peer.close?.()

    peers.clear()
    awareness.destroy()
    doc.destroy()
  }

  return {
    name,
    doc,
    awareness,
    join,
    destroy,
    loaded,
    get size() {
      return peers.size
    },
  }
}

export { AWARENESS, SYNC } from './protocol.js'
