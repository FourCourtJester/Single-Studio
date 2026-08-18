import { createRoom } from './room.js'
import { createTokens } from './tokens.js'

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

const TOKENS = 'tokens'

export class Room {
  #room = null

  #tokens = null

  /** peer -> the token id it connected with, so a revocation can find it. */
  #holders = new Map()

  constructor(state, env) {
    this.state = state
    this.env = env
  }

  get tokens() {
    this.#tokens ??= createTokens({
      load: () => this.state.storage.get(TOKENS),
      save: (plain) => this.state.storage.put(TOKENS, plain),
    })

    return this.#tokens
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

  async fetch(request) {
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)

    if (parts[1] === 'tokens') return this.manage(request, url, parts[2])

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response(JSON.stringify({ relay: 'single-studio', peers: this.room.size }), { headers: { 'content-type': 'application/json' } })
    }

    // A room nobody has issued a token for is open: that is the development case
    // and the single-operator case, and demanding a token before anyone has minted
    // one means a relay that does nothing until you read the manual. One live token
    // and the room is guarded.
    const offered = url.searchParams.get('token')
    const holder = (await this.tokens.guarded(this.name)) ? await this.tokens.check(this.name, offered) : null

    if ((await this.tokens.guarded(this.name)) && !holder) return new Response('unauthorized', { status: 401 })

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

    if (holder) this.#holders.set(peer, holder.id)

    const gone = () => {
      this.#holders.delete(peer)
      handle.close()
    }

    server.addEventListener('message', (event) => handle.message(new Uint8Array(event.data)))
    server.addEventListener('close', gone)
    server.addEventListener('error', gone)

    return new Response(null, { status: 101, webSocket: client })
  }

  get name() {
    return this.state.id.toString()
  }

  /**
   * Mint, list and revoke, guarded by a separate secret the host machine holds.
   *
   * Different powers deserve different keys: an operator's token lets them edit a
   * show, and this one lets them remove other operators. Without RELAY_ADMIN set
   * the API is off entirely rather than open, because an unguarded mint endpoint
   * is a worse default than no endpoint.
   */
  async manage(request, url, id) {
    /**
     * The board and the relay are always different origins -- the relay is a
     * separate service by design -- so the token API is unusable from a browser
     * without these. `*` is safe here because the guard is the bearer token and
     * nothing rides on cookies.
     */
    const json = (status, body) =>
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'authorization, content-type',
          'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        },
      })

    // The preflight an Authorization header forces the browser to send first.
    if (request.method === 'OPTIONS') return json(204, null)

    const admin = this.env.RELAY_ADMIN

    if (!admin) return json(404, { error: 'token administration is not enabled on this relay' })

    const offered = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? url.searchParams.get('admin')

    if (offered !== admin) return json(401, { error: 'unauthorized' })

    if (request.method === 'GET') return json(200, { tokens: await this.tokens.list(this.name) })

    if (request.method === 'POST') {
      const body = await request.json().catch(() => null)

      if (body === null) return json(400, { error: 'body must be JSON' })

      // The one and only time a secret is returned.
      return json(201, { token: await this.tokens.issue(this.name, { name: body.name ?? '' }) })
    }

    if (request.method === 'DELETE') {
      if (!id) return json(400, { error: 'which token?' })

      const revoked = await this.tokens.revoke(this.name, id)

      // Immediately, not at the next reconnect: somebody removed mid-show must not
      // keep editing until they happen to refresh.
      if (revoked) {
        for (const [peer, held] of this.#holders) {
          if (held === id) peer.close?.()
        }
      }

      return revoked ? json(200, { token: revoked }) : json(404, { error: 'no such token' })
    }

    return json(405, { error: 'method not allowed' })
  }
}

const ok = (name) => /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(name)

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const name = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ''))

    if (!name) return new Response(JSON.stringify({ relay: 'single-studio' }), { headers: { 'content-type': 'application/json' } })
    if (!ok(name)) return new Response('bad room name', { status: 400 })

    // Authorisation happens inside the object, where the room's own token list
    // lives. Nothing here can answer "may this person join *this* room".
    return env.ROOM.get(env.ROOM.idFromName(name)).fetch(request)
  },
}
