import { definePlugin, Emitter, PluginHandler, Service } from '@single-studio/core/worker'

import { categoriesFor, EVENTS, normalise } from './events'
import { authenticate, classify, identify, maskOf, request } from './protocol'

export { CATEGORY, OP, authenticate, classify, maskOf } from './protocol'
export { EVENTS, categoriesFor, normalise } from './events'

/**
 * OBS, over obs-websocket, in the SharedWorker.
 *
 * The one every studio wants and the one nobody thinks of first, because OBS is
 * where the studio already lives. Knowing which scene is live lets a graphic decide
 * for itself: a lower third that hides when the camera cuts away, a scoreboard that
 * only counts while the match scene is up, a "LIVE" badge that is honest.
 *
 * Ingress only. OBS is bidirectional and switching scenes from the board is the
 * obvious next thing, but that is the deferred command work -- it needs the routing
 * question answered first, or a remote operator's button press has nowhere to go.
 *
 * Requests are here regardless, because reading needs them: OBS announces changes
 * and never announces the present, so a studio that only listened would not know
 * the scene until somebody changed it. The plugin asks once on connect.
 */
class Obs extends Service {
  static serviceName = 'obs'

  #socket = null

  #pending = new Map()

  #nextId = 0

  events = new Emitter()

  constructor(context) {
    super({ mutate: context.mutate, owner: context.owner })

    this.config = context.config
    this.studio = context.studio
  }

  get types() {
    const asked = String(this.config.events ?? '')
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean)

    return asked.length ? asked : Object.keys(EVENTS)
  }

  get url() {
    const host = this.config.host || 'localhost'
    const port = Number(this.config.port) || 4455

    return `ws://${host}:${port}`
  }

  open() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url)

      this.#socket = socket

      socket.addEventListener('message', (message) => this.#read(message, resolve, reject))
      socket.addEventListener('error', () =>
        reject(new Error(`Could not reach OBS at ${this.url}. Is obs-websocket enabled under Tools -> WebSocket Server Settings?`)),
      )
      socket.addEventListener('close', () => {
        if (socket === this.#socket) this.dropped(new Error('OBS closed the connection.'))
      })
    })
  }

  async #read(message, resolve, reject) {
    let raw

    try {
      raw = JSON.parse(message.data)
    } catch {
      return
    }

    const action = classify(raw)

    switch (action.do) {
      case 'identify': {
        // A password is only needed when OBS asks. Sending one it did not ask for
        // is refused, and refusing to connect because a studio left the field empty
        // would be wrong for the common case of authentication switched off.
        if (action.auth && !this.config.password) {
          reject(new Error('OBS is asking for a password, and none is set.'))

          return
        }

        const authentication = action.auth ? await authenticate(this.config.password, action.auth.salt, action.auth.challenge) : undefined

        this.#send(
          identify({
            rpcVersion: action.rpcVersion,
            authentication,
            eventSubscriptions: maskOf(categoriesFor(this.types)),
          }),
        )

        return
      }

      case 'ready':
        this.emit('connected', { rpcVersion: action.rpcVersion })

        // OBS announces changes and never announces the present. Without this a
        // studio does not know the scene until somebody changes it -- which on a
        // quiet show could be the whole broadcast.
        this.#prime().then(resolve, resolve)

        return

      case 'event': {
        const { name, payload } = normalise(action.type, action.data)

        this.emit(name, payload)
        this.emit('*', name, payload)

        return
      }

      case 'response': {
        const settle = this.#pending.get(action.id)

        this.#pending.delete(action.id)
        settle?.(action)

        return
      }

      default:
    }
  }

  #send(frame) {
    this.#socket?.send(JSON.stringify(frame))
  }

  /**
   * Ask something and wait for the matching reply.
   *
   * Correlated by `requestId` rather than by order: OBS may answer out of order,
   * and matching on arrival would attach one reply to another request's promise.
   */
  ask(requestType, requestData) {
    const id = `ss-${(this.#nextId += 1)}`

    return new Promise((resolve) => {
      this.#pending.set(id, resolve)
      this.#send(request(requestType, id, requestData))
    })
  }

  /** Read the present, once, so the first paint is not a guess. */
  async #prime() {
    const scene = await this.ask('GetCurrentProgramScene')

    if (scene.ok) this.emit('scene', { name: scene.data.currentProgramSceneName ?? scene.data.sceneName ?? null, raw: scene.data })

    const stream = await this.ask('GetStreamStatus')

    if (stream.ok) {
      this.emit('stream', {
        active: Boolean(stream.data.outputActive),
        state: stream.data.outputActive ? 'started' : 'stopped',
        live: Boolean(stream.data.outputActive),
        settling: false,
        raw: stream.data,
      })
    }
  }

  async close() {
    const socket = this.#socket

    this.#socket = null
    this.#pending.clear()
    socket?.close()
  }

  emit(...args) {
    return this.events.emit(...args)
  }
}

/** The skeleton a studio fills in. One method per event, all no-ops. */
export class ObsHandler extends PluginHandler {
  static handles = {
    connected: 'onConnected',
    scene: 'onScene',
    preview: 'onPreview',
    sourceVisibility: 'onSourceVisibility',
    stream: 'onStream',
    record: 'onRecord',
    mute: 'onMute',
    transitionStarted: 'onTransitionStarted',
    transitionEnded: 'onTransitionEnded',
    exit: 'onExit',
  }

  onConnected() {}

  onScene() {}

  onPreview() {}

  onSourceVisibility() {}

  onStream() {}

  onRecord() {}

  onMute() {}

  onTransitionStarted() {}

  onTransitionEnded() {}

  onExit() {}
}

/** @param {typeof ObsHandler} [Handler] */
export const obs = (Handler = ObsHandler) =>
  definePlugin({
    name: 'obs',
    label: 'OBS',
    config: [
      { key: 'host', label: 'Host', default: 'localhost', help: 'The machine running OBS. Usually this one.' },
      { key: 'port', label: 'Port', type: 'number', default: 4455, help: 'Tools → WebSocket Server Settings.' },
      { key: 'password', label: 'Password', type: 'secret', help: 'Only if OBS is asking for one.' },
      { key: 'events', label: 'Events', help: 'Comma separated. Blank for all of them.' },
    ],
    create: (context) => {
      const plugin = new Obs(context)

      new Handler({ ...context, plugin }).attach(plugin.events)

      return plugin
    },
  })
