import { Emitter } from '../toolkits/emitter'
import { Service } from './Service'

// Everything a plugin that talks over a WebSocket does before it does anything
// interesting.
//
// Written after three plugins rather than before them, which is why it is this
// shape: OBS and Twitch independently grew the same open/parse/teardown code, the
// same "is this still the live socket" check, and the same watchdog -- and got the
// watchdog subtly different. Somebody writing a fourth should not have to rediscover
// any of it, and should not be free to get it wrong in a new way.
//
// What a subclass writes is `receive`, and usually nothing else.

export class SocketService extends Service {
  /** The events a studio's handler is attached to. */
  events = new Emitter()

  #socket = null

  #watchdog = null

  /**
   * @param {object} context
   * @param {(name: string, payload: unknown) => unknown} context.mutate
   * @param {() => boolean} [context.owner]
   * @param {Record<string, unknown>} [context.config]
   * @param {string} [context.studio]
   */
  constructor(context = {}) {
    super({ mutate: context.mutate, owner: context.owner })

    this.config = context.config ?? {}
    this.studio = context.studio
  }

  /**
   * Where to connect. A subclass builds this from its own config.
   *
   * @returns {string}
   * @abstract
   */
  get url() {
    throw new Error(`${this.name} must implement a \`url\` getter`)
  }

  /**
   * How long to allow with no traffic at all before deciding the connection is
   * gone, or 0 for no watchdog.
   *
   * Worth having wherever the far end sends anything periodically. A socket can
   * die without a close frame, and the symptom is the worst kind: an overlay that
   * looks completely healthy and is frozen.
   *
   * @returns {number} Milliseconds.
   */
  get silenceBudgetMs() {
    return 0
  }

  /**
   * One message, already parsed. The whole of what most subclasses write.
   *
   * @param {unknown} _message
   * @param {WebSocket} _socket The socket it came from, which matters during a handover.
   * @abstract
   */

  async receive(_message, _socket) {
    throw new Error(`${this.name} must implement \`receive\``)
  }

  /**
   * Called once the socket is open, before any message.
   *
   * Most protocols say hello first and expect the client to answer, so there is
   * usually nothing to do here -- but a protocol that expects the client to speak
   * first has nowhere else to do it.
   */
  async greet() {}

  /**
   * Whether `open()` should resolve as soon as the socket is open.
   *
   * False for a protocol with a handshake: OBS and Twitch are not usable until they
   * have identified or welcomed, and resolving early would report a plugin as
   * connected while it is still negotiating. Those subclasses call `ready()`.
   */
  get readyOnOpen() {
    return true
  }

  #settle = null

  open() {
    return new Promise((resolve, reject) => {
      this.#settle = { resolve, reject }

      const socket = this.connect(this.url)

      this.#socket = socket

      socket.addEventListener('open', () => {
        Promise.resolve(this.greet()).catch((error) => this.fail(error))
        if (this.readyOnOpen) this.ready()
      })

      socket.addEventListener('message', (event) => {
        // Any traffic at all means the connection is alive, which is what the
        // watchdog measures -- not keepalives specifically.
        this.pet()

        let parsed

        try {
          parsed = JSON.parse(event.data)
        } catch {
          // A frame that is not JSON is not this protocol. Ignored rather than
          // fatal: a proxy or a browser extension can inject one.
          return
        }

        Promise.resolve(this.receive(parsed, socket)).catch((error) => this.fail(error))
      })

      socket.addEventListener('error', () => this.fail(new Error(`Could not reach ${this.name} at ${this.url}.`)))

      socket.addEventListener('close', () => {
        // Only when this is still the live socket. A protocol that hands over to a
        // new connection closes the old one on purpose, and treating that as a drop
        // would restart a healthy connection.
        if (socket === this.#socket) this.dropped(new Error(`${this.name} closed the connection.`))
      })
    })
  }

  /**
   * Build the socket. Overridable so a test can hand one in.
   *
   * @param {string} url
   */
  connect(url) {
    return new WebSocket(url)
  }

  /** The socket currently considered live. */
  get socket() {
    return this.#socket
  }

  /**
   * Adopt a different socket as the live one, closing whatever it replaces.
   *
   * For protocols that hand over rather than close -- the old connection keeps
   * delivering until the new one is ready, so nothing is missed in the gap.
   */
  adopt(socket) {
    if (socket === this.#socket) return

    const previous = this.#socket

    this.#socket = socket
    previous?.close()
  }

  /** Say the connection is usable. Resolves `open()`. */
  ready() {
    this.#settle?.resolve()
    this.#settle = null
    this.pet()
  }

  /**
   * Say it is not, and why.
   *
   * Before the connection is up this rejects `open()`, which is what puts the
   * reason in front of an operator. Afterwards it is a drop, which backs off.
   */
  fail(error) {
    if (this.#settle) {
      this.#settle.reject(error)
      this.#settle = null

      return
    }

    this.dropped(error)
  }

  /** Restart the silence timer. */
  pet() {
    clearTimeout(this.#watchdog)

    const budget = this.silenceBudgetMs

    if (!budget) return

    this.#watchdog = setTimeout(() => this.dropped(new Error(`${this.name} went quiet.`)), budget)
  }

  /** @param {unknown} frame Serialised as JSON. */
  send(frame) {
    this.#socket?.send(JSON.stringify(frame))
  }

  /**
   * The commands this service accepts, by the name a studio author uses, each
   * building the frame that goes on the wire.
   *
   * A table rather than a method per command, for the same reason the events are a
   * table: it is the list somebody reads to find out what a plugin can be asked, and
   * a name that is not in it is a mistake rather than a frame the far end will
   * quietly ignore.
   *
   * Declared per protocol because the envelope is. Rocket League wants
   * `{ Command, Data }`; obs-websocket wants an opcode and a request id. There is
   * nothing shared to put in the base class beyond the guards below.
   *
   * @type {Record<string, (data: object) => unknown>}
   */
  static commands = {}

  /**
   * Send one command, if this machine is the one that should.
   *
   * The three answers are deliberately different, because they are three different
   * kinds of thing:
   *
   *   - **An unknown name throws.** It is a typo in a studio's own code, it will
   *     never work, and the far end would swallow the frame without a word. Loud, at
   *     the moment it is written.
   *   - **Not the owner returns false, quietly.** On a collaborating show this is
   *     the normal state of every machine but one, several times a match. Throwing
   *     would mean every handler wrapping every command in the same guard, and the
   *     first author to forget would fill a colleague's console during a show.
   *   - **No connection returns false too.** The game is not running, or is starting
   *     up. A handler should not have to check.
   *
   * The ownership check is the important one. Ingress has a single owner so five
   * machines do not write the same paths; egress needs it for a sharper reason --
   * five machines telling the same OBS to change scene is five scene changes, and
   * four of them come from people who cannot see what they did.
   *
   * @param {string} name
   * @param {object} [data]
   * @returns {boolean} Whether it went.
   */
  command(name, data = {}) {
    const build = this.constructor.commands?.[name]

    if (typeof build !== 'function') {
      const known = Object.keys(this.constructor.commands ?? {})

      throw new Error(`${this.name} has no command "${name}"${known.length ? `; it accepts ${known.join(', ')}` : ' and accepts none yet'}`)
    }

    if (!this.owns) return false
    if (!this.#socket) return false

    this.send(build(data))

    return true
  }

  async close() {
    clearTimeout(this.#watchdog)

    const socket = this.#socket

    this.#socket = null
    this.#settle = null
    socket?.close()
  }

  emit(...args) {
    return this.events.emit(...args)
  }
}
