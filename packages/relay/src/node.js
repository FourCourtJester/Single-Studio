import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, join as joinPath } from 'node:path'

import { WebSocketServer } from 'ws'

import { createRoom } from './room.js'
import { createTokens } from './tokens.js'

// A relay you can run anywhere Node runs.
//
// The Durable Object in worker.js is the recommended deployment -- it costs
// nothing at this scale and needs no machine to look after. This exists for three
// other cases that are all real: someone who would rather self-host, someone
// developing against a relay without deploying, and the test suite, which needs a
// relay it can start and stop in-process to prove two peers converge.
//
// Storage is one file per room, optional. Without it a room lives as long as the
// process, which is fine for development and wrong for a show.

const ok = (name) => /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(name)

export function createRelay({ storage, authorize, admin, saveAfter } = {}) {
  const rooms = new Map()
  /** peer -> the token id it connected with, so a revocation can find it. */
  const holders = new Map()

  const fileFor = (name) => joinPath(storage, `${name}.bin`)
  const tokenFile = () => joinPath(storage, 'tokens.json')

  const tokens = createTokens({
    load: storage
      ? () =>
          readFile(tokenFile(), 'utf8')
            .then(JSON.parse)
            .catch(() => null)
      : undefined,
    save: storage
      ? async (plain) => {
          await mkdir(dirname(tokenFile()), { recursive: true })
          await writeFile(tokenFile(), JSON.stringify(plain, null, 2))
        }
      : undefined,
  })

  /**
   * Who may join, in order of least surprise.
   *
   * A room nobody has issued a token for is open. That is the development case and
   * the single-operator case, and demanding a token before anyone has made one
   * would mean a relay that does nothing until you read the manual. The moment a
   * room has one live token it is guarded, and an unrecognised secret is refused.
   *
   * `authorize` overrides all of it, for anyone wiring this into their own auth.
   */
  async function allowed({ room, token, request, url }) {
    if (authorize) return authorize({ room, token, request, url, tokens })
    if (!(await tokens.guarded(room))) return true

    return (await tokens.check(room, token)) ?? false
  }

  /** Hang up on anyone holding a token that has just been revoked. */
  function evict(room, id) {
    for (const [peer, held] of holders) {
      if (held.room !== room || held.id !== id) continue

      try {
        peer.close?.()
      } catch {
        // Already gone, which is the outcome we wanted anyway.
      }
    }
  }

  function roomFor(name) {
    if (rooms.has(name)) return rooms.get(name)

    const room = createRoom({
      name,
      saveAfter,
      load: storage ? () => readFile(fileFor(name)).catch(() => null) : undefined,
      save: storage
        ? async (update) => {
            await mkdir(dirname(fileFor(name)), { recursive: true })
            await writeFile(fileFor(name), update)
          }
        : undefined,
      // Rooms are cheap, and a show that empties for thirty seconds between
      // segments should not pay a storage read to come back. They are dropped when
      // the process stops, or explicitly by close().
    })

    rooms.set(name, room)

    return room
  }

  /** `/<room>?token=…`, which is what y-websocket's client produces. */
  function routeOf(request) {
    const url = new URL(request.url, 'http://relay.local')
    const name = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ''))

    return { name, token: url.searchParams.get('token'), url }
  }

  const sockets = new WebSocketServer({ noServer: true })

  async function upgrade(request, socket, head) {
    const { name, token, url } = routeOf(request)

    if (!ok(name)) {
      socket.destroy()
      return
    }

    // Refused before the upgrade, so an unauthorised client gets an HTTP status it
    // can actually read rather than a socket that closes for no stated reason.
    const pass = await allowed({ room: name, token, request, url })

    if (!pass) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }

    sockets.handleUpgrade(request, socket, head, (ws) => {
      const peer = {
        send: (bytes) => ws.readyState === ws.OPEN && ws.send(bytes),
        close: () => ws.close(),
      }

      if (pass?.id) holders.set(peer, { room: name, id: pass.id })

      // Synchronously, before anything can be awaited: a peer's opening syncStep1
      // is already in flight by the time this callback runs, and the room queues
      // what arrives before it is ready rather than dropping it.
      const handle = roomFor(name).join(peer)

      ws.on('message', (data) => handle.message(new Uint8Array(data)))
      const gone = () => {
        holders.delete(peer)
        handle.close()
      }

      ws.on('close', gone)
      ws.on('error', gone)
    })
  }

  async function close(server) {
    // Rooms first: destroy() takes a final undebounced save, so whatever the last
    // few hundred milliseconds of a show produced is on disk before the socket
    // that carried it goes away.
    await Promise.all([...rooms.values()].map((room) => room.destroy()))
    rooms.clear()
    sockets.close()

    if (server) await new Promise((resolve) => server.close(resolve))
  }

  /**
   * The admin API: mint a token, list them, revoke one.
   *
   * Guarded by a separate secret that only the host machine holds, because these
   * are different powers. An operator's token lets them edit a show; the admin
   * token lets them remove other operators. Without `admin` set, the API is off
   * entirely rather than open -- an unguarded mint endpoint is a worse default
   * than no endpoint.
   *
   * Revocation hangs up on the socket immediately. Waiting for the next reconnect
   * would mean somebody removed mid-show keeps editing until they happen to
   * refresh, which is exactly the moment you needed it to work.
   */
  async function manage(request, response, url) {
    /**
     * The board and the relay are always different origins -- the relay is a
     * separate service by design -- so the token API is unusable from a browser
     * without these. `*` is safe here because the guard is the bearer token and
     * nothing rides on cookies: a permissive origin grants no more than knowing
     * the secret already did.
     */
    const send = (status, body) => {
      response.writeHead(status, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      })
      response.end(body === null ? '' : JSON.stringify(body))
    }

    // The preflight an Authorization header forces the browser to send first.
    if (request.method === 'OPTIONS') return send(204, null)

    if (!admin) return send(404, { error: 'token administration is not enabled on this relay' })

    const offered = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? url.searchParams.get('admin')

    if (offered !== admin) return send(401, { error: 'unauthorized' })

    const [, room, , id] = url.pathname.split('/')

    if (!ok(room)) return send(400, { error: 'bad room name' })

    if (request.method === 'GET') return send(200, { tokens: await tokens.list(room) })

    if (request.method === 'POST') {
      const body = await new Promise((resolve) => {
        let raw = ''

        request.on('data', (chunk) => (raw += chunk))
        request.on('end', () => resolve(raw))
      })

      let name

      try {
        name = JSON.parse(body || '{}').name ?? ''
      } catch {
        return send(400, { error: 'body must be JSON' })
      }

      // The one and only time a secret is returned. It is not readable again --
      // losing it means issuing another, which is cheap and is the right trade for
      // not keeping every operator's credential legible on the relay.
      return send(201, { token: await tokens.issue(room, { name }) })
    }

    if (request.method === 'DELETE') {
      if (!id) return send(400, { error: 'which token?' })

      const revoked = await tokens.revoke(room, id)

      if (revoked) evict(room, id)

      return send(revoked ? 200 : 404, revoked ? { token: revoked } : { error: 'no such token' })
    }

    return send(405, { error: 'method not allowed' })
  }

  return {
    rooms,
    tokens,
    upgrade,
    manage,
    close,

    /** Attach to an http.Server you already have. */
    attach(server) {
      server.on('upgrade', upgrade)

      return server
    },

    /** Or take the whole server. Resolves once it is listening. */
    listen(port = 1234, host = '127.0.0.1') {
      const server = createServer((request, response) => {
        const url = new URL(request.url, 'http://relay.local')

        if (url.pathname.split('/')[2] === 'tokens') return manage(request, response, url)

        // Something for a health check, and for anyone who opens the URL in a
        // browser wondering whether the thing is up.
        response.writeHead(200, { 'content-type': 'application/json' })

        return response.end(JSON.stringify({ relay: 'single-studio', rooms: [...rooms.keys()] }))
      })

      server.on('upgrade', upgrade)

      return new Promise((resolve) => {
        server.listen(port, host, () => resolve({ server, port: server.address().port, close: () => close(server) }))
      })
    },
  }
}
