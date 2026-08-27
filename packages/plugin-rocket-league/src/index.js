import { definePlugin, PluginHandler, SocketService } from '@single-studio/core/worker'

import { EVENTS, gameState, normalise, scoreOf } from './events'

export { EVENTS, SIDES, gameState, normalise, scoreOf, sideOf } from './events'

/**
 * Rocket League's own Stats API, over the WebSocket that v2.72 added.
 *
 * Psyonix shipped this as a raw TCP socket, which a browser cannot open -- every
 * overlay built before August 2026 runs a local bridge to convert it. v2.72 added
 * WebSocket support, and that is the whole reason this plugin can exist: a studio
 * stays static files with nothing running alongside it.
 *
 * Ingress only. v2.72 also added commands going the other way -- spectator target,
 * replay seek, HUD visibility -- and those are the deferred work, because a remote
 * operator pressing a button needs a way to reach the machine with the game on it.
 */
class RocketLeague extends SocketService {
  static serviceName = 'rocket-league'

  /** The last score emitted, so the tick can be quiet when nothing scored. */
  #score = null

  /** When `state` was last emitted, for the throttle. */
  #statedAt = 0

  get url() {
    const host = this.config.host || '127.0.0.1'
    const port = Number(this.config.port) || 49122

    // The path is configurable because Psyonix's WebSocket endpoint is documented
    // where this could not read it. A bare `ws://host:port` is the usual shape and
    // the default; if it turns out to want `/ws` or similar, that is a settings
    // change on the night rather than a release.
    const path = this.config.path ? `/${String(this.config.path).replace(/^\/+/, '')}` : ''

    return `ws://${host}:${port}${path}`
  }

  /**
   * No watchdog, deliberately.
   *
   * The base class offers one because a socket can die without a close frame, and
   * OBS and Twitch both want it. This one does not: the game says nothing at all
   * while nobody is in a match, so a silence budget would drop a perfectly healthy
   * connection every time an operator sat in the menu between games -- and
   * reconnecting is the one thing that cannot be done quietly here, because the
   * next match's first events are what a studio is waiting for.
   */
  get silenceBudgetMs() {
    return 0
  }

  /**
   * How often the full tick is worth passing on, in milliseconds.
   *
   * The game sends `UpdateState` up to 120 times a second and 30 is usual. Every
   * one of those carries each player's boost and speed, and a studio that wrote
   * them into a replicated document would be spending roughly five kilobytes a
   * second, persisted and sent to every peer, on numbers stale before anybody reads
   * them.
   *
   * Four a second is plenty for anything an eye is watching, and the events that
   * matter -- goals, the clock, the whistle -- arrive as their own messages anyway.
   */
  get stateEveryMs() {
    // Not `|| 250`: an operator who types 0 means "stop sending me the tick", and a
    // falsy check would hand them the default instead -- the one value in the field
    // that has to work is the one that switch would swallow.
    const set = this.config.stateEvery

    if (set === '' || set === null || set === undefined) return 250

    const every = Number(set)

    return Number.isFinite(every) ? Math.max(0, every) : 250
  }

  async receive(raw) {
    const type = raw?.Event
    const data = raw?.Data

    if (!type) return

    if (type === 'UpdateState') {
      this.#tick(data)

      return
    }

    const { name, payload } = normalise(type, data)

    this.emit(name, payload)
    this.emit('*', name, payload)
  }

  /**
   * The tick, which is the only part of this that needs a policy.
   *
   * The score comes out of it whatever the throttle says, because a scoreboard
   * changing a quarter of a second late is a scoreboard that is wrong on the replay
   * -- and because `GoalScored` says who scored and not what the score became.
   */
  #tick(data) {
    const score = scoreOf(data)

    if (!this.#score || this.#score.blue !== score.blue || this.#score.orange !== score.orange) {
      this.#score = score
      this.emit('score', score)
    }

    const every = this.stateEveryMs

    if (!every) return

    const now = Date.now()

    if (now - this.#statedAt < every) return

    this.#statedAt = now
    this.emit('state', gameState(data))
  }
}

/**
 * The skeleton a studio fills in.
 *
 * One method per event, all no-ops. Override the handful a show cares about --
 * usually `onGoal`, `onScore` and `onClock` -- and leave the rest.
 */
export class RocketLeagueHandler extends PluginHandler {
  static handles = {
    // The two a scoreboard is made of.
    score: 'onScore',
    clock: 'onClock',

    goal: 'onGoal',
    statfeed: 'onStatfeed',

    matchCreated: 'onMatchCreated',
    matchReady: 'onMatchReady',
    countdown: 'onCountdown',
    roundStarted: 'onRoundStarted',
    paused: 'onPaused',
    unpaused: 'onUnpaused',
    matchEnded: 'onMatchEnded',
    matchDestroyed: 'onMatchDestroyed',
    podium: 'onPodium',

    replayStart: 'onReplayStart',
    replayEnding: 'onReplayEnding',
    replayEnd: 'onReplayEnd',
    replaySaved: 'onReplaySaved',

    ballHit: 'onBallHit',
    crossbar: 'onCrossbar',
    boostPickup: 'onBoostPickup',

    playerJoined: 'onPlayerJoined',
    playerLeft: 'onPlayerLeft',

    /** The whole tick, throttled. Most shows never need it. */
    state: 'onState',
  }

  onScore() {}

  onClock() {}

  onGoal() {}

  onStatfeed() {}

  onMatchCreated() {}

  onMatchReady() {}

  onCountdown() {}

  onRoundStarted() {}

  onPaused() {}

  onUnpaused() {}

  onMatchEnded() {}

  onMatchDestroyed() {}

  onPodium() {}

  onReplayStart() {}

  onReplayEnding() {}

  onReplayEnd() {}

  onReplaySaved() {}

  onBallHit() {}

  onCrossbar() {}

  onBoostPickup() {}

  onPlayerJoined() {}

  onPlayerLeft() {}

  onState() {}
}

/** @param {typeof RocketLeagueHandler} [Handler] */
export const rocketLeague = (Handler = RocketLeagueHandler) =>
  definePlugin({
    name: 'rocket-league',
    label: 'Rocket League',
    summary: 'Reads the game directly: score, clock, goals and the stat feed.',
    help: [
      {
        type: 'text',
        text: 'Rocket League can send this itself — no BakkesMod, no extra program. It is off by default and turning it on means editing one file.',
      },
      {
        type: 'steps',
        items: [
          'Close Rocket League.',
          'Open <Rocket League install>\\TAGame\\Config\\DefaultStatsAPI.ini in a text editor. If there is a TAStatsAPI.ini beside it, edit that one instead.',
          'Under [TAGame.MatchStatsExporter_TA], set PacketSendRate to 30 and Port to 49122.',
          'Save the file and start Rocket League. The settings are only read at startup.',
          'Press Save and reconnect here.',
        ],
      },
      { type: 'note', text: 'PacketSendRate of 0 switches the feature off entirely. Anything above about 30 is more than a scoreboard can use.' },
      { type: 'text', text: 'Leave Path blank unless connecting fails — it exists for the case where the endpoint wants one.' },
      { type: 'link', href: 'https://www.rocketleague.com/developer/stats-api', label: 'Psyonix’s Stats API documentation' },
      {
        type: 'text',
        text: 'This needs Rocket League v2.72 or newer, which is when the WebSocket was added. Before that the game only spoke raw TCP, which a browser cannot open at all.',
      },
    ],
    config: [
      { key: 'host', label: 'Host', default: '127.0.0.1', help: 'The machine running the game. Usually this one.' },
      { key: 'port', label: 'Port', type: 'number', default: 49122, help: 'Whatever you set as Port in the ini file.' },
      { key: 'path', label: 'Path', default: '', help: 'Leave blank. Only needed if the endpoint turns out to want one.' },
      {
        key: 'stateEvery',
        label: 'Full state every (ms)',
        type: 'number',
        default: 250,
        help: 'The game ticks up to 120 times a second. 0 switches the state event off; goals and the clock still arrive.',
      },
    ],
    create: (context) => {
      const plugin = new RocketLeague(context)

      new Handler({ ...context, plugin }).attach(plugin.events)

      return plugin
    },
  })

/** Every event the plugin can emit, for anybody enumerating them. */
export const EMITS = [...new Set([...Object.values(EVENTS).map((entry) => entry.emit), 'score', 'state'])]
