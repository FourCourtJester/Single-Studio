import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, join as joinPath } from 'node:path'

import { WebSocketServer } from 'ws'

import { createRoom } from './room.js'

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

export function createRelay({ storage, authorize, saveAfter } = {}) {
  const rooms = new Map()

  const fileFor = (name) => joinPath(storage, `${name}.bin`)

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
    if (authorize && !(await authorize({ room: name, token, request, url }))) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }

    sockets.handleUpgrade(request, socket, head, (ws) => {
      const peer = {
        send: (bytes) => ws.readyState === ws.OPEN && ws.send(bytes),
        close: () => ws.close(),
      }

      // Synchronously, before anything can be awaited: a peer's opening syncStep1
      // is already in flight by the time this callback runs, and the room queues
      // what arrives before it is ready rather than dropping it.
      const handle = roomFor(name).join(peer)

      ws.on('message', (data) => handle.message(new Uint8Array(data)))
      ws.on('close', handle.close)
      ws.on('error', handle.close)
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

  return {
    rooms,
    upgrade,
    close,

    /** Attach to an http.Server you already have. */
    attach(server) {
      server.on('upgrade', upgrade)

      return server
    },

    /** Or take the whole server. Resolves once it is listening. */
    listen(port = 1234, host = '127.0.0.1') {
      const server = createServer((request, response) => {
        // Something for a health check, and for anyone who opens the URL in a
        // browser wondering whether the thing is up.
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ relay: 'single-studio', rooms: [...rooms.keys()] }))
      })

      server.on('upgrade', upgrade)

      return new Promise((resolve) => {
        server.listen(port, host, () => resolve({ server, port: server.address().port, close: () => close(server) }))
      })
    },
  }
}
