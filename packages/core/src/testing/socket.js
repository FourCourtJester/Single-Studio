// A WebSocket that does nothing until a test tells it to.
//
// Every socket plugin needs one, and before this every socket plugin wrote one:
// three near-identical classes in three repositories-worth of test files, each
// re-deriving that `addEventListener` collects handlers and that a message arrives
// as `{ data: string }`. The differences that mattered were four or five lines of
// protocol each; the rest was the same rig copied.
//
// It is here rather than in a plugin because a fake is only as good as its
// faithfulness to the thing it fakes, and the thing it fakes is `SocketService`'s
// idea of a socket. Shipping them together means one changing without the other is
// a change to one file.
//
// **Deliver what the far end really sends.** The most expensive bug this codebase
// has had was a fake that was tidier than the game: Rocket League nests a JSON
// *string* inside its frame, the fake passed an object, and every field read
// `undefined` while the suite stayed green. Making the fake faithful turned seven
// passing tests red at once. A fake that is easier to write than the protocol is a
// fake that is lying.

export class FakeSocket {
  /** Every frame the plugin sent, parsed. */
  sent = []

  closed = false

  #listeners = {}

  constructor(url) {
    this.url = url
  }

  addEventListener(type, fn) {
    ;(this.#listeners[type] ??= []).push(fn)
  }

  removeEventListener(type, fn) {
    this.#listeners[type] = (this.#listeners[type] ?? []).filter((one) => one !== fn)
  }

  /** What the service calls. Recorded rather than sent anywhere. */
  send(text) {
    this.sent.push(JSON.parse(text))
  }

  close() {
    this.closed = true
  }

  /** Fire one of the socket's own events, with no payload beyond `data`. */
  emit(type, data) {
    for (const fn of this.#listeners[type] ?? []) fn(data === undefined ? {} : { data })
  }

  /** The connection came up. `SocketService.open()` resolves on this. */
  open() {
    this.emit('open')
  }

  /** The connection refused. `open()` rejects, and the retry runs. */
  fail() {
    this.emit('error')
  }

  /** The far end hung up on a live connection. */
  drop() {
    this.emit('close')
  }

  /** One frame, as JSON, the way a real socket delivers it. */
  deliver(frame) {
    this.emit('message', JSON.stringify(frame))
  }

  /**
   * One frame exactly as given, JSON or not.
   *
   * For the cases a well-behaved fake would never produce: a proxy injecting HTML,
   * a keepalive that is not JSON, a protocol that double-encodes. Those are worth
   * testing precisely because a fake that only ever sends valid frames cannot.
   */
  raw(text) {
    this.emit('message', text)
  }
}

/**
 * A `WebSocket` stand-in, plus the list of every one the service opened.
 *
 * The list is the half that is easy to leave out and awkward to add later: a
 * reconnect, a handover, or a second machine each open another socket, and a test
 * that only holds the first is testing the wrong one.
 *
 *   const { sockets, Socket } = fakeSockets()
 *   vi.stubGlobal('WebSocket', Socket)
 *   // ...
 *   sockets[0].open()
 *
 * @param {typeof FakeSocket} [Kind] A subclass, for a protocol's own shorthand.
 * @returns {{ sockets: FakeSocket[], Socket: typeof FakeSocket, reset: () => void }}
 *
 * The return is annotated rather than inferred: the collector is an anonymous
 * subclass, and a class with a private field cannot be named in an inferred type at
 * all -- `TS4094`, which is a real error and not a lint opinion.
 */
export function fakeSockets(Kind = FakeSocket) {
  const sockets = []

  class Collected extends Kind {
    constructor(url) {
      super(url)
      sockets.push(this)
    }
  }

  return {
    sockets,
    Socket: Collected,
    reset: () => {
      sockets.length = 0
    },
  }
}
