import { definePlugin, PluginHandler, SocketService } from '@single-studio/core/worker'

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
 * Requests were always here, because reading needs them: OBS announces changes and
 * never announces the present, so a studio that only listened would not know the
 * scene until somebody changed it. The plugin asks once on connect.
 *
 * A handful of them are now declared as commands, so a studio can answer as well as
 * listen -- cut the scene when the whistle goes. What is still deferred is a
 * *remote* operator pressing a button, which is a routing problem rather than a
 * protocol one. See architecture.md#commands.
 */
class Obs extends SocketService {
  static serviceName = 'obs'

  /**
   * What a studio can ask OBS to do.
   *
   * A deliberately small list: the things a show does *to itself* while it is
   * running. OBS accepts a hundred-odd requests and most of them configure it --
   * creating scenes, moving sources, setting up encoders -- which is the operator's
   * job at build time and not something a graphic should be doing at five to seven.
   *
   * `requestId` is a constant rather than a counter because nothing waits for the
   * reply. `ask` correlates because it has a promise to settle; a command is told,
   * not asked, and OBS ignores an id it is not being asked about.
   */
  static commands = {
    /** Cut to a scene by name. The one everybody wants. */
    scene: ({ name }) => request('SetCurrentProgramScene', 'ss-cmd', { sceneName: name }),

    /** Load a scene into preview, for a studio-mode operator to take manually. */
    preview: ({ name }) => request('SetCurrentPreviewScene', 'ss-cmd', { sceneName: name }),

    stream: ({ on }) => request(on ? 'StartStream' : 'StopStream', 'ss-cmd'),
    record: ({ on }) => request(on ? 'StartRecord' : 'StopRecord', 'ss-cmd'),
    pauseRecord: ({ on }) => request(on ? 'PauseRecord' : 'ResumeRecord', 'ss-cmd'),

    /** Show or hide one source within a scene. Needs the scene's item id. */
    item: ({ scene, id, visible }) => request('SetSceneItemEnabled', 'ss-cmd', { sceneName: scene, sceneItemId: id, sceneItemEnabled: Boolean(visible) }),
  }

  #pending = new Map()

  #nextId = 0

  /** Not usable until identified, so `open()` waits for that rather than the socket. */
  get readyOnOpen() {
    return false
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

  async receive(raw) {
    const action = classify(raw)

    switch (action.do) {
      case 'identify': {
        // A password is only needed when OBS asks. Sending one it did not ask for
        // is refused, and refusing to connect because a studio left the field empty
        // would be wrong for the common case of authentication switched off.
        if (action.auth && !this.config.password) {
          this.fail(new Error('OBS is asking for a password, and none is set.'))

          return
        }

        const authentication = action.auth ? await authenticate(this.config.password, action.auth.salt, action.auth.challenge) : undefined

        this.send(
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
        this.#prime().then(
          () => this.ready(),
          () => this.ready(),
        )

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
      this.send(request(requestType, id, requestData))
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
    this.#pending.clear()
    await super.close()
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
    summary: 'Reads the live scene, and whether you are streaming or recording.',
    help: [
      { type: 'text', text: 'OBS can already do this — there is nothing to install. It just has to be switched on.' },
      {
        type: 'steps',
        items: [
          'In OBS, open Tools → WebSocket Server Settings.',
          'Tick "Enable WebSocket server".',
          'Leave the port as 4455 unless you have a reason to change it.',
          'If "Enable Authentication" is ticked, press "Show Connect Info" and copy the password into the field above. If it is not ticked, leave the password blank.',
          'Press Apply, then Save and reconnect here.',
        ],
      },
      { type: 'note', text: 'Running OBS on another machine? Put its address in Host, and make sure that machine allows the connection through its firewall.' },
      {
        type: 'text',
        text: 'Once connected, your graphics can react to the scene that is live — a lower third that hides itself when the camera cuts away, or a badge that only shows while you are actually streaming.',
      },
    ],
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
