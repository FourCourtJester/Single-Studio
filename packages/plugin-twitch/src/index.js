import { definePlugin, Emitter, PluginHandler, Service } from '@single-studio/core/worker'

import { EVENTS, normalise } from './events'
import { Protocol } from './protocol'

export { EVENTS, normalise, scopesFor } from './events'
export { Protocol } from './protocol'

const EVENTSUB = 'wss://eventsub.wss.twitch.tv/ws'
const HELIX = 'https://api.twitch.tv/helix/eventsub/subscriptions'

/**
 * Twitch chat, follows, subs, gifts, cheers and raids, in the SharedWorker.
 *
 * In the worker rather than on a page for the reason every ingress is: one socket
 * for the whole studio. A chat overlay, a board, and an alert graphic are three
 * pages, and three sockets would be three copies of every message and three sets of
 * Twitch's rate limits to spend.
 *
 * Extends `Service`, so reconnection, exponential backoff and the ownership
 * predicate come from the framework. What is here is the part that is Twitch's:
 * the session handshake, the keepalive watchdog, and the subscriptions that have to
 * be created after connecting rather than before.
 */
class Twitch extends Service {
  static serviceName = 'twitch'

  #socket = null

  /** The socket being handed over to, during a reconnect. */
  #next = null

  #watchdog = null

  #protocol = new Protocol()

  /** Settled by the first welcome, so `open()` resolves only once subscribed. */
  #opened = null

  /** The emitter a studio's handler is attached to. */
  events = new Emitter()

  constructor(context) {
    super({ mutate: context.mutate, owner: context.owner })

    // `name` comes from Service, off `serviceName`. Assigning it throws, because
    // the base declares it as a getter.
    this.config = context.config
    this.studio = context.studio
  }

  /** The events this studio asked for, or all of them. */
  get types() {
    const asked = String(this.config.events ?? '')
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean)

    return asked.length ? asked : Object.keys(EVENTS)
  }

  async open() {
    if (!this.config.token) throw new Error('Not signed in to Twitch yet.')
    if (!this.config.clientId) throw new Error('A Twitch application Client ID is needed.')
    if (!this.config.broadcasterId) throw new Error('The broadcaster user id is needed.')

    await this.#connect(EVENTSUB)
  }

  #connect(url) {
    return new Promise((resolve, reject) => {
      this.#opened = { resolve, reject }

      const socket = new WebSocket(url)

      socket.addEventListener('message', (message) => this.#read(socket, message))
      socket.addEventListener('error', () => reject(new Error('Could not reach Twitch EventSub.')))
      socket.addEventListener('close', () => {
        // Only if this is still the live socket: a reconnect closes the old one on
        // purpose, and treating that as a drop would restart a healthy connection.
        if (socket === this.#socket) this.dropped(new Error('EventSub closed the connection.'))
      })
    })
  }

  async #read(socket, message) {
    let raw

    try {
      raw = JSON.parse(message.data)
    } catch {
      return
    }

    const action = this.#protocol.handle(raw)

    // Any message at all means the connection is alive, which is what the watchdog
    // is actually measuring -- not keepalives specifically.
    this.#pet()

    switch (action.do) {
      case 'subscribe': {
        // A welcome on the incoming socket during a handover: that one is now the
        // live one, and the old can go.
        if (socket === this.#next) {
          this.#socket?.close()
          this.#socket = this.#next
          this.#next = null

          // Subscriptions belong to the session, and the new session already has
          // them -- Twitch carries them across a reconnect. Nothing to create.
          return
        }

        this.#socket = socket

        try {
          await this.#subscribe(action.session)
          this.#opened?.resolve()
        } catch (error) {
          this.#opened?.reject(error)
        }

        return
      }

      case 'deliver': {
        const { name, payload } = normalise(action.type, action.event)

        this.emit(name, payload)
        this.emit('*', name, payload)

        return
      }

      case 'reconnect':
        // Twitch hands over a URL rather than closing, so the old socket keeps
        // delivering until the new one has welcomed. Nothing is missed.
        this.#next = new WebSocket(action.url)
        this.#next.addEventListener('message', (event) => this.#read(this.#next, event))

        return

      case 'revoked':
        // Otherwise the events simply stop and the overlay looks fine.
        this.emit('revoked', { type: action.type, reason: action.reason })
        console.warn(`[twitch] ${action.type} was revoked: ${action.reason}`)

        return

      default:
    }
  }

  /**
   * Restart the silence timer.
   *
   * Twitch sends a keepalive whenever it has sent nothing else, so silence past the
   * budget is the connection being gone without a close frame -- the failure that
   * leaves a chat overlay looking healthy and frozen.
   */
  #pet() {
    clearTimeout(this.#watchdog)
    this.#watchdog = setTimeout(() => this.dropped(new Error('Twitch went quiet.')), this.#protocol.silenceBudgetMs)
  }

  /**
   * Create the subscriptions for this session.
   *
   * After the welcome rather than before it: the session id is what ties a
   * subscription to this socket, and it does not exist until Twitch says so.
   */
  async #subscribe(session) {
    const failures = []

    for (const type of this.types) {
      const known = EVENTS[type]
      const condition = { broadcaster_user_id: String(this.config.broadcasterId) }

      // Each type words its condition differently, and a wrong one is rejected as a
      // 400 that reads like a scope problem.
      if (type === 'channel.chat.message') condition.user_id = String(this.config.userId || this.config.broadcasterId)
      if (type === 'channel.follow') condition.moderator_user_id = String(this.config.userId || this.config.broadcasterId)
      if (type === 'channel.raid') {
        delete condition.broadcaster_user_id
        condition.to_broadcaster_user_id = String(this.config.broadcasterId)
      }

      const response = await fetch(HELIX, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'Client-Id': this.config.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          version: known?.version ?? '1',
          condition,
          transport: { method: 'websocket', session_id: session },
        }),
      })

      if (!response.ok) failures.push(`${type} (${response.status})`)
    }

    // Some working is better than none: a studio missing `bits:read` should still
    // get chat rather than a dead plugin.
    if (failures.length === this.types.length) throw new Error(`Twitch refused every subscription: ${failures.join(', ')}`)
    if (failures.length) console.warn(`[twitch] some subscriptions were refused: ${failures.join(', ')}`)
  }

  async close() {
    clearTimeout(this.#watchdog)
    this.#socket?.close()
    this.#next?.close()
    this.#socket = null
    this.#next = null
  }

  emit(...args) {
    return this.events.emit(...args)
  }
}

/** The skeleton a studio fills in. One method per event, all no-ops. */
export class TwitchHandler extends PluginHandler {
  static handles = {
    chat: 'onChat',
    follow: 'onFollow',
    subscribe: 'onSubscribe',
    resub: 'onResub',
    gift: 'onGift',
    cheer: 'onCheer',
    raid: 'onRaid',
    revoked: 'onRevoked',
  }

  onChat() {}

  onFollow() {}

  onSubscribe() {}

  onResub() {}

  onGift() {}

  onCheer() {}

  onRaid() {}

  onRevoked() {}
}

/**
 * @param {typeof TwitchHandler} [Handler] The studio's subclass.
 */
export const twitch = (Handler = TwitchHandler) =>
  definePlugin({
    name: 'twitch',
    label: 'Twitch',
    config: [
      { key: 'clientId', label: 'Client ID', help: 'From your app at dev.twitch.tv/console/apps. Public, not a secret.' },
      { key: 'broadcasterId', label: 'Channel user id', help: 'The numeric id of the channel to watch.' },
      { key: 'userId', label: 'Your user id', help: 'Usually the same as the channel. Differs when a moderator runs the board.' },
      { key: 'token', label: 'Access token', type: 'secret' },
      { key: 'events', label: 'Events', help: 'Comma separated. Blank for all of them.' },
    ],
    create: (context) => {
      const plugin = new Twitch(context)

      new Handler({ ...context, plugin }).attach(plugin.events)

      return plugin
    },
  })
