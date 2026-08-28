import { definePlugin, PluginHandler, SocketService } from '@single-studio/core/worker'

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
class Twitch extends SocketService {
  static serviceName = 'twitch'

  /** The socket being handed over to, during a reconnect. */
  #next = null

  #protocol = new Protocol()

  /** Not usable until subscribed, so `open()` waits for that rather than the socket. */
  get readyOnOpen() {
    return false
  }

  get url() {
    return EVENTSUB
  }

  /** Sized by what Twitch said in the welcome rather than by a guess. */
  get silenceBudgetMs() {
    return this.#protocol.silenceBudgetMs
  }

  /** The events this studio asked for, or all of them. */
  get types() {
    const asked = String(this.config.events ?? '')
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean)

    return asked.length ? asked : Object.keys(EVENTS)
  }

  open() {
    if (!this.config.token) return Promise.reject(new Error('Not signed in to Twitch yet.'))
    if (!this.config.clientId) return Promise.reject(new Error('A Twitch application Client ID is needed.'))
    if (!this.config.broadcasterId) return Promise.reject(new Error('The broadcaster user id is needed.'))

    return super.open()
  }

  async receive(raw, socket) {
    const action = this.#protocol.handle(raw)

    switch (action.do) {
      case 'subscribe': {
        // A welcome on the incoming socket during a handover: that one is now the
        // live one, and the old can go.
        if (socket === this.#next) {
          // Subscriptions belong to the session, and the new session already has
          // them -- Twitch carries them across a reconnect. Nothing to create.
          this.adopt(socket)
          this.#next = null

          return
        }

        try {
          await this.#subscribe(action.session)
          this.ready()
        } catch (error) {
          this.fail(error)
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
        this.#next = this.connect(action.url)
        this.#next.addEventListener('message', (event) => {
          this.pet()

          try {
            this.receive(JSON.parse(event.data), this.#next)
          } catch {
            // Not JSON, so not this protocol.
          }
        })

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
    this.#next?.close()
    this.#next = null
    await super.close()
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
    summary: 'Chat, follows, subs, gifts, cheers and raids, straight into the show.',
    help: [
      {
        type: 'note',
        text: 'Signing in properly is not built yet, so for now this needs an access token pasted in by hand. Tokens expire, so expect to redo this.',
      },
      {
        type: 'steps',
        items: [
          'Register an application at dev.twitch.tv/console/apps. The Client ID it gives you is public — paste it above.',
          'Find your channel’s numeric user id (any "Twitch username to user id" tool will do) and paste it into both id fields.',
          'Generate a user access token with the scopes below and paste it into Access token.',
          'Save and reconnect.',
        ],
      },
      { type: 'text', text: 'Scopes needed, depending on which events you want:' },
      {
        type: 'code',
        text: 'user:read:chat            chat messages\nmoderator:read:followers  follows\nchannel:read:subscriptions subs, resubs and gifts\nbits:read                 cheers',
      },
      { type: 'link', href: 'https://dev.twitch.tv/console/apps', label: 'Twitch developer console' },
      {
        type: 'text',
        text: 'Leave Events blank for all of them, or list the ones you want — a studio that only shows chat need not ask for subscription scopes at all.',
      },
    ],
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
