import { definePlugin, PluginHandler, SocketService } from '@single-studio/core/worker'

import { pollToken, refreshTokens, requestCode, revoke, whoIs } from './auth.js'
import { EVENTS, normalise, scopesFor } from './events.js'
import { Protocol } from './protocol.js'

export { EVENTS, normalise, scopesFor } from './events.js'
export { Protocol } from './protocol.js'

/** Where Twitch is. */
const TWITCH = { eventsub: 'wss://eventsub.wss.twitch.tv/ws', helix: 'https://api.twitch.tv/helix' }

/**
 * Where the Twitch CLI's mock EventSub server is, by default.
 *
 * `twitch event websocket start-server` -- see dev/README.md. Written from the CLI's
 * documentation rather than run from here, so both halves can be overridden.
 */
const MOCK = { eventsub: 'ws://127.0.0.1:8080/ws', helix: 'http://127.0.0.1:8080' }

/** Refresh a token this long before it runs out, rather than finding out from a 401. */
const EARLY = 5 * 60 * 1000

/** What signing out, or being signed out, clears. */
const SIGNED_OUT = { token: '', refresh: '', expiresAt: 0, userId: '', login: '' }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

  /** What the studio author passed to `twitch()`: the Client ID, and where Twitch is. */
  #options

  /** The host's way to store into this plugin's own config. */
  #save

  /** The sign-in in progress, if there is one. Compared by identity, so a cancel ends it. */
  #signing = null

  /** The code the operator is typing somewhere, while a sign-in waits on them. */
  #waiting = null

  /** The last thing a sign-in had to say that was not "done": a denial, an expiry. */
  #said = null

  /** The channel's numeric id, resolved at connect time from what the operator typed. */
  #broadcaster = ''

  constructor(context, options = {}) {
    super(context)

    this.#options = options
    this.#save = context.save ?? (async () => ({ ok: false }))
  }

  /** The author's, when they gave one; otherwise whatever the operator typed. */
  get clientId() {
    return this.#options.clientId || this.config.clientId || ''
  }

  get #mock() {
    return Boolean(this.#options.mock)
  }

  /** Which buttons make sense right now. Never both "Sign in" and "Sign out". */
  get offers() {
    if (this.#mock) return []
    if (this.#signing) return ['cancel']

    return this.config.token ? ['signOut'] : ['signIn']
  }

  /** What the panel shows: the code while waiting, then who is signed in. */
  get notice() {
    if (this.#waiting) return this.#waiting
    if (this.#said) return this.#said
    if (this.#mock) return { text: 'Mock mode: talking to the Twitch CLI on this machine, not to Twitch.' }
    if (this.config.token && this.config.login) return { text: `Signed in as ${this.config.login}.` }

    return null
  }

  async act(key) {
    if (key === 'signIn') return this.#signIn()

    if (key === 'cancel') {
      this.#signing = null
      this.#waiting = null

      return undefined
    }

    if (key === 'signOut') {
      await revoke({ clientId: this.clientId, token: this.config.token })

      return this.#save(SIGNED_OUT)
    }

    throw new Error(`Twitch has no action "${key}"`)
  }

  /**
   * Start a sign-in, and return once there is a code to show.
   *
   * Returns early on purpose: the operator is about to spend a minute on another
   * device, and the panel's button should not sit on "Working…" for all of it. The
   * rest happens in `#await`, and the panel follows it through the notice.
   */
  async #signIn() {
    if (!this.clientId) throw new Error('This studio has no Twitch Client ID. Its author sets one when adding the plugin.')

    const device = await requestCode({ clientId: this.clientId, scopes: scopesFor(this.types) })
    const ticket = {}

    this.#signing = ticket
    this.#said = null
    this.#waiting = {
      text: 'Go to twitch.tv/activate on any device, sign in, and enter this code.',
      code: device.userCode,
      href: device.uri,
      label: 'Open twitch.tv/activate',
    }

    this.#await(device, ticket).catch((error) => {
      if (this.#signing !== ticket) return

      this.#signing = null
      this.#waiting = null
      this.#said = { text: error?.message ?? String(error) }
    })
  }

  /** Ask Twitch at the pace it set until the operator approves, refuses, or the code runs out. */
  async #await(device, ticket) {
    let interval = device.interval

    while (this.#signing === ticket) {
      await sleep(interval * 1000)

      if (this.#signing !== ticket) return

      if (Date.now() > device.expiresAt) throw new Error('That code ran out before it was entered. Press Sign in with Twitch for a new one.')

      const answer = await pollToken({ clientId: this.clientId, scopes: scopesFor(this.types), deviceCode: device.deviceCode })

      if (answer.pending) continue

      // Twitch asking for less: back off by its own step and keep going.
      if (answer.slowDown) {
        interval += 5
        continue
      }

      const who = await whoIs({ token: answer.token })

      if (this.#signing !== ticket) return

      this.#signing = null
      this.#waiting = null

      // Stored, then restarted on it: the Save button's own path, so what comes back
      // is a plugin that connects as the person who just signed in.
      await this.#save({ ...answer, userId: who?.userId ?? '', login: who?.login ?? '' })

      return
    }
  }

  /**
   * A token that is about to run out, swapped before it does.
   *
   * The refresh token is single use, so the new pair is stored before anything else
   * can go wrong -- losing it would sign the machine out. Stored without a restart:
   * this runs inside a connect, and the running plugin already has the new values.
   */
  async #fresh({ force = false } = {}) {
    const { refresh, expiresAt } = this.config

    if (!refresh) return
    if (!force && (!expiresAt || Number(expiresAt) - Date.now() > EARLY)) return

    try {
      const tokens = await refreshTokens({ clientId: this.clientId, refresh })

      Object.assign(this.config, tokens)
      await this.#save(tokens, { restart: false })
    } catch (error) {
      if (error?.signedOut) {
        Object.assign(this.config, SIGNED_OUT)
        await this.#save(SIGNED_OUT, { restart: false })
      }

      throw error
    }
  }

  /**
   * The numeric id of the channel to watch.
   *
   * Nobody knows their numeric id, so nobody is asked for it. Blank means the
   * account that signed in; a name means that channel, looked up -- which is what a
   * moderator running somebody else's board types.
   */
  async #channel() {
    const typed = String(this.config.channel ?? '').trim()

    if (this.#mock) return /^\d+$/.test(typed) ? typed : '12345'
    if (/^\d+$/.test(typed)) return typed

    if (!typed) {
      if (this.config.userId) return String(this.config.userId)

      const who = await whoIs({ token: this.config.token })

      if (!who) throw new Error('Twitch no longer accepts this sign-in. Sign in again.')

      Object.assign(this.config, who)
      await this.#save(who, { restart: false })

      return who.userId
    }

    const response = await fetch(`${this.#helix}/users?login=${encodeURIComponent(typed.toLowerCase())}`, { headers: this.#headers })
    const body = await response.json().catch(() => ({}))
    const id = body?.data?.[0]?.id

    if (!response.ok) throw new Error(`Twitch would not look up the channel "${typed}" (${response.status}).`)
    if (!id) throw new Error(`There is no Twitch channel called "${typed}".`)

    return String(id)
  }

  get #helix() {
    return this.#options.helix ?? (this.#mock ? MOCK.helix : TWITCH.helix)
  }

  get #headers() {
    return {
      Authorization: `Bearer ${this.config.token || 'mock'}`,
      'Client-Id': this.clientId || 'mock',
      'Content-Type': 'application/json',
    }
  }

  /** Not usable until subscribed, so `open()` waits for that rather than the socket. */
  get readyOnOpen() {
    return false
  }

  /**
   * Longer than the default, because `ready()` here is much further away than a
   * socket coming up.
   *
   * Between the two are a welcome frame and then one HTTP round trip per event
   * type, in a row -- seven by default. Ten seconds is comfortable for a handshake
   * and is not obviously comfortable for that, and being wrong is not a slow
   * connection but a retry loop that fails at the same place every time. The
   * deadline is still worth having: it is bounded, and the failure it exists for
   * -- a socket accepted and then abandoned -- is not made likelier by a bigger
   * number.
   */
  get connectBudgetMs() {
    return 30_000
  }

  get url() {
    return this.#options.eventsub ?? (this.#mock ? MOCK.eventsub : TWITCH.eventsub)
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

  async open() {
    if (!this.#mock) {
      if (!this.clientId) throw new Error('This studio has no Twitch Client ID. Its author sets one when adding the plugin.')
      if (!this.config.token) throw new Error('Not signed in to Twitch yet. Press Sign in with Twitch.')

      await this.#fresh()
    }

    this.#broadcaster = await this.#channel()

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
  async #subscribe(session, retried = false) {
    const failures = []
    const broadcaster = this.#broadcaster
    const me = String(this.config.userId || broadcaster)

    for (const type of this.types) {
      const known = EVENTS[type]
      const condition = { broadcaster_user_id: broadcaster }

      // Each type words its condition differently, and a wrong one is rejected as a
      // 400 that reads like a scope problem.
      if (type === 'channel.chat.message') condition.user_id = me
      if (type === 'channel.follow') condition.moderator_user_id = me
      if (type === 'channel.raid') {
        delete condition.broadcaster_user_id
        condition.to_broadcaster_user_id = broadcaster
      }

      const response = await fetch(`${this.#helix}/eventsub/subscriptions`, {
        method: 'POST',
        headers: this.#headers,
        body: JSON.stringify({
          type,
          version: known?.version ?? '1',
          condition,
          transport: { method: 'websocket', session_id: session },
        }),
      })

      if (!response.ok) failures.push({ type, status: response.status })
    }

    // Every one refused as unauthorised is a token that died between the refresh
    // check and now. One refresh and one more go, not a loop.
    if (!retried && !this.#mock && failures.length === this.types.length && failures.every((failure) => failure.status === 401) && this.config.refresh) {
      await this.#fresh({ force: true })

      return this.#subscribe(session, true)
    }

    const said = failures.map((failure) => `${failure.type} (${failure.status})`).join(', ')

    // Some working is better than none: a studio missing `bits:read` should still
    // get chat rather than a dead plugin.
    if (failures.length === this.types.length) throw new Error(`Twitch refused every subscription: ${said}`)
    if (failures.length) console.warn(`[twitch] some subscriptions were refused: ${said}`)

    return undefined
  }

  async close() {
    // A sign-in waiting on the operator ends with the plugin that started it.
    this.#signing = null
    this.#waiting = null
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
 * @typedef {object} TwitchOptions
 * @property {string} [clientId] Your Twitch application's Client ID. Public, not a
 *   secret, so it belongs in the build: register one app, as a *Public* client, and
 *   every operator of the studio signs in through it without ever seeing Twitch's
 *   developer console. Leave it out and the panel asks each operator for one.
 * @property {boolean} [mock] Talk to the Twitch CLI's mock server on this machine
 *   instead of Twitch. No sign-in. See dev/README.md in this package.
 * @property {string} [eventsub] Override the EventSub WebSocket address.
 * @property {string} [helix] Override the Helix API base, without a trailing slash.
 */

/**
 * @param {typeof TwitchHandler} [Handler] The studio's subclass.
 * @param {TwitchOptions} [options]
 */
export const twitch = (Handler = TwitchHandler, options = {}) =>
  definePlugin({
    name: 'twitch',
    label: 'Twitch',
    summary: 'Chat, follows, subs, gifts, cheers and raids, straight into the show.',
    help: [
      {
        type: 'steps',
        items: [
          'Press Sign in with Twitch.',
          'Go to twitch.tv/activate on any device — your phone is fine — and sign in as the channel.',
          'Type the code shown here, and approve.',
          'That is all. This machine stays signed in until you sign out.',
        ],
      },
      {
        type: 'text',
        text: 'Running a board for somebody else’s channel as their moderator? Sign in as yourself and type their channel name under Channel.',
      },
      {
        type: 'text',
        text: 'Leave Events blank for all of them, or list the ones you want. Twitch only asks for the permissions those events need.',
      },
    ],
    actions: [
      { key: 'signIn', label: 'Sign in with Twitch' },
      { key: 'cancel', label: 'Cancel sign-in' },
      { key: 'signOut', label: 'Sign out' },
    ],
    config: [
      // Only when the studio did not bring one. An operator should never have to
      // visit Twitch's developer console; the author does it once for everybody.
      ...(options.clientId || options.mock
        ? []
        : [{ key: 'clientId', label: 'Client ID', help: 'This studio does not come with one. From an app registered as a Public client at dev.twitch.tv/console/apps.' }]),
      {
        key: 'channel',
        label: 'Channel',
        placeholder: 'The one you signed in as',
        help: 'Blank for your own. A moderator types the channel’s name.',
      },
      { key: 'events', label: 'Events', help: 'Comma separated. Blank for all of them.' },
    ],
    create: (context) => {
      const plugin = new Twitch(context, options)

      new Handler({ ...context, plugin }).attach(plugin.events)

      return plugin
    },
  })
