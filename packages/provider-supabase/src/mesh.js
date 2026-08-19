import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as syncProtocol from 'y-protocols/sync'

// Replication with no relay in the middle.
//
// The relay in packages/relay holds a document of its own and answers each peer
// individually. This does not: every message goes to everybody, and every peer
// answers what it can. That is what lets the transport underneath be a plain
// broadcast channel from a hosted service -- something the user signs up for in
// two minutes and we never hold a key to -- instead of something they deploy.
//
// The trade is one thing, stated plainly: with nobody holding the document, an
// operator who opens their board while every other machine is off sees an empty
// show until somebody comes up. During a broadcast that cannot happen, because the
// machine running OBS is by definition on.
//
// Transport-agnostic on purpose, the same way the room is. It is handed a `send`
// and told when bytes arrive, so the same logic runs over Supabase Realtime, over
// anything else with a channel, and over a pair of fakes in a test.

const SYNC = 0
const AWARENESS = 1

const encoded = (write) => {
  const encoder = encoding.createEncoder()

  write(encoder)

  return encoding.toUint8Array(encoder)
}

export function createMeshProvider({ doc, send, report, name = 'mesh' }) {
  const awareness = new awarenessProtocol.Awareness(doc)

  // Nothing is announced until a studio says who is here. An empty slot would show
  // up in everyone's operator list as a nameless ghost.
  awareness.setLocalState(null)

  let open = false
  let destroyed = false

  /**
   * Hand bytes to the transport, and notice when it does not take them.
   *
   * A transport may fail long after the call returns -- a hosted channel answers
   * with a status rather than throwing, and a rejected promise is invisible to a
   * `try`. That matters more here than the usual tidiness argument: a dropped
   * broadcast is a lost edit, the peers quietly diverge, and the board goes on
   * saying "connected". Silent divergence on air is the exact failure this whole
   * system is built to make impossible, so it is reported rather than swallowed.
   */
  const post = (bytes) => {
    if (destroyed || !open) return

    try {
      const sending = send(bytes)

      if (typeof sending?.catch === 'function') {
        sending.catch((error) => {
          console.error(`[${name}] could not send`, error)
          report?.('error', 'An edit did not reach the other machines. They may be showing something different.')
        })
      }
    } catch (error) {
      console.error(`[${name}] could not send`, error)
      report?.('error', 'An edit did not reach the other machines. They may be showing something different.')
    }
  }

  /** "Here is what I have; send me what I am missing." */
  const hello = () =>
    encoded((encoder) => {
      encoding.writeVarUint(encoder, SYNC)
      syncProtocol.writeSyncStep1(encoder, doc)
    })

  const onUpdate = (update, origin) => {
    // Anything that arrived from a peer is already everywhere it needs to be.
    if (origin === name) return

    post(
      encoded((encoder) => {
        encoding.writeVarUint(encoder, SYNC)
        syncProtocol.writeUpdate(encoder, update)
      }),
    )
  }

  const onAwareness = ({ added, updated, removed }, origin) => {
    if (origin === name) return

    const changed = [...added, ...updated, ...removed]

    if (!changed.length) return

    post(
      encoded((encoder) => {
        encoding.writeVarUint(encoder, AWARENESS)
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changed))
      }),
    )
  }

  doc.on('update', onUpdate)
  awareness.on('update', onAwareness)

  return {
    awareness,

    /** Bytes from any peer. Replies go to everybody, which is what makes it a mesh. */
    receive(bytes) {
      if (destroyed) return

      try {
        const decoder = decoding.createDecoder(bytes)
        const type = decoding.readVarUint(decoder)

        if (type === SYNC) {
          const encoder = encoding.createEncoder()

          encoding.writeVarUint(encoder, SYNC)
          // `name` as the origin is what stops the answer being rebroadcast as if
          // it were a local edit -- without it two peers answer each other forever.
          syncProtocol.readSyncMessage(decoder, encoder, doc, name)

          if (encoding.length(encoder) > 1) post(encoding.toUint8Array(encoder))

          return
        }

        if (type === AWARENESS) awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), name)
      } catch (error) {
        // One malformed message must not cost the connection.
        console.error(`[${name}] bad message from a peer`, error)
      }
    },

    /**
     * The channel is up. Says hello, and offers who is here.
     *
     * Separate from construction because a transport connects asynchronously, and
     * anything sent before it is listening is simply gone.
     */
    connected() {
      open = true
      report?.('connected')
      post(hello())

      const state = awareness.getLocalState()

      if (state && Object.keys(state).length) onAwareness({ added: [doc.clientID], updated: [], removed: [] }, null)
    },

    /**
     * A new peer appeared. Offers the show rather than asking for it.
     *
     * The distinction matters and is easy to get backwards. A syncStep1 asks "what
     * am I missing" -- so greeting a newcomer with one only teaches *us* something,
     * and a peer whose own hello was lost stays empty forever, looking connected
     * the whole time. Handing over the document is what actually welcomes them.
     */
    greet() {
      post(hello())
      post(
        encoded((encoder) => {
          encoding.writeVarUint(encoder, SYNC)
          syncProtocol.writeUpdate(encoder, Y.encodeStateAsUpdate(doc))
        }),
      )
    },

    disconnected(why) {
      open = false
      report?.('connecting', why)
    },

    destroy() {
      // Goodbye first, while there is still a channel to say it on. Closing and
      // then announcing leaves the operator in everyone else's list until they
      // reload -- a ghost at the board.
      awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], 'destroy')

      destroyed = true
      open = false
      doc.off('update', onUpdate)
      awareness.off('update', onAwareness)
      awareness.destroy()
    },
  }
}
