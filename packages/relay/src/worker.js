import { createRoom } from './room.js'

// The Cloudflare deployment: one Durable Object per room.
//
// Recommended because of what it does not cost. There is no machine to keep
// running, the free tier covers a small production comfortably, and the object
// hibernates between shows. A studio deploys their own with one command and we
// host nothing -- which is the point, since a relay that we ran would be a
// dependency on us that the local-first design exists to avoid.
//
// A Durable Object is a natural fit for this shape: Cloudflare guarantees one
// instance per name globally, so "the room" is a single object holding the
// document rather than a cluster with a consensus problem.

const STORED = 'doc'

export class Room {
  #room = null

  constructor(state, env) {
    this.state = state
    this.env = env
  }

  /** Built lazily so an object woken for a health check does not load a document. */
  get room() {
    this.#room ??= createRoom({
      name: this.state.id.toString(),
      load: () => this.state.storage.get(STORED),
      save: (update) => this.state.storage.put(STORED, update),
    })

    return this.#room
  }

  fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response(JSON.stringify({ relay: 'single-studio', peers: this.room.size }), { headers: { 'content-type': 'application/json' } })
    }

    const { 0: client, 1: server } = new WebSocketPair()

    server.accept()

    const peer = {
      send: (bytes) => {
        try {
          server.send(bytes)
        } catch {
          // The socket went away between the broadcast and this call. The room
          // drops the peer; there is nothing else to do about it here.
        }
      },
      close: () => server.close(),
    }

    // Synchronously: the peer's opening syncStep1 is already in flight, and the
    // room queues what arrives before it is ready rather than dropping it.
    const handle = this.room.join(peer)

    server.addEventListener('message', (event) => handle.message(new Uint8Array(event.data)))
    server.addEventListener('close', handle.close)
    server.addEventListener('error', handle.close)

    return new Response(null, { status: 101, webSocket: client })
  }
}

const ok = (name) => /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(name)

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const name = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ''))

    if (!name) return new Response(JSON.stringify({ relay: 'single-studio' }), { headers: { 'content-type': 'application/json' } })
    if (!ok(name)) return new Response('bad room name', { status: 400 })

    // A shared token is the floor, not the ceiling. Per-operator tokens, payload
    // encryption and a revocation path are stage 4 in docs/collaboration.md: a
    // production loses operators, and that must not mean rotating one secret
    // everyone else has to be re-told.
    if (env.RELAY_TOKEN && url.searchParams.get('token') !== env.RELAY_TOKEN) {
      return new Response('unauthorized', { status: 401 })
    }

    return env.ROOM.get(env.ROOM.idFromName(name)).fetch(request)
  },
}
