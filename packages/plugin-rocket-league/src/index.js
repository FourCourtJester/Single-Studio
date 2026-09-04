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
 * Ingress only, for now, and not for a reason worth defending. v2.72 added commands
 * going the other way -- spectator target, replay load and seek, playback speed, HUD
 * visibility -- and a command sent *in reaction to an event* needs no mechanism at
 * all: the event arrived on the machine running the game, so the answer goes back
 * down the socket it came in on. The base class provides `command` and the table
 * below is where those would be declared.
 *
 * It is empty because the wire names are the one thing this could not read. Psyonix
 * documents them where CI cannot reach, and inventing six plausible strings would
 * ship a plugin whose commands are silently ignored by the game -- worse than one
 * that admits it has none, because `command()` refuses an unknown name loudly and a
 * guessed name would look like it worked.
 *
 * Filling it in is a five-line change once the names are to hand. An author who
 * knows one already can send it with `this.plugin.send({ Command, Data })`.
 */
/**
 * The fastest the tick is ever passed on, whatever an operator types.
 *
 * A policy decision rather than a measurement, though the measurements agree with
 * it: nothing on a stream updates visibly more than ten times a second, and the
 * document pays for every emit that a handler turns into a write. Ten a second is
 * already generous for something an eye is watching, and the events that carry
 * meaning -- goals, the clock, the whistle -- do not come through here at all.
 *
 * A floor rather than a default, because the default is only the value somebody has
 * not changed yet. This is the value they cannot.
 */
const FLOOR_MS = 100

/**
 * The payload, whichever way it arrived.
 *
 * The game double-encodes: the frame is JSON, and `Data` inside it is *another*
 * JSON string rather than an object. Read straight through, every field lookup on
 * it is `undefined` -- so a clock reads zero, a score reads zero, and nothing
 * throws, because a shape's `?? 0` turns the miss into a plausible number. The only
 * visible symptom is a graphic that is confidently wrong.
 *
 * Both forms are accepted rather than the string alone, because what the pre-2.72
 * socket sent is not written down anywhere this could check, and taking an object
 * as it comes costs nothing.
 */
function unwrap(data) {
  if (typeof data !== 'string') return data

  try {
    return JSON.parse(data)
  } catch {
    // Not JSON after all. Hand it over as it came rather than losing it -- an
    // unknown event's `raw` is the only way anybody finds out what the game sent.
    return data
  }
}

/**
 * Events that arrive faster than anything can react to them, and are worth keeping
 * anyway.
 *
 * A dribble is a ball hit every few frames, and six players crossing a pitch take
 * boost pads continuously. Neither is something a graphic changes for -- nobody has
 * ever cut to a lower third because somebody touched the ball -- but both are
 * exactly what a stats package wants afterwards, so throttling them by dropping
 * would throw away the only thing they are good for.
 *
 * So they collate the other way round from the tick. `state` is a sample, where the
 * newest reading makes every earlier one worthless and keeping the last is the whole
 * job. These are facts: each one happened, none replaces another, and the batch is
 * the thing worth handing over. Same ceiling, opposite collation.
 *
 * The name changes with the shape. A studio author overriding `onBallHits(hits)` is
 * told by the signature that they are getting a list; one overriding `onBallHit`
 * that quietly started receiving an array would find out on air.
 */
const BATCHED = { ballHit: 'ballHits', boostPickup: 'boostPickups' }

class RocketLeague extends SocketService {
  static serviceName = 'rocket-league'

  /**
   * What a studio can ask the game to do. Empty until the v2.72 command names are
   * confirmed -- see the note above, and `docs/internal/rocket-league.md`.
   */
  static commands = {}

  /** The last score emitted, so the tick can be quiet when nothing scored. */
  #score = null

  /** When `state` was last emitted, for the throttle. */
  #statedAt = 0

  /** The newest tick not yet passed on. Replaced, never queued. */
  #pending = null

  /** The timer that will pass it on. */
  #flush = null

  /** Facts collected since the last batch went out, by the name they go out under. */
  #batches = new Map()

  /** The timer that will send them. */
  #batch = null

  get url() {
    const host = this.config.host || 'localhost'
    const port = Number(this.config.port) || 49124

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
   * How often the full tick is passed on, in milliseconds.
   *
   * The game sends `UpdateState` up to 120 times a second and 30 is usual. Every
   * one of those carries each player's boost and speed, and a studio that wrote
   * them straight into a replicated document would spend fourteen kilobytes a
   * second -- four megabytes over a five-minute match, persisted, and downloaded in
   * full by every board that joins late -- on numbers stale before anybody reads
   * them.
   *
   * Four a second is the default and is plenty; ten a second is the ceiling, and
   * `FLOOR_MS` is what makes it one. The events that carry meaning -- goals, the
   * clock, the whistle -- arrive as their own messages and are never throttled.
   */
  get stateEveryMs() {
    // Not `|| 250`: an operator who types 0 means "stop sending me the tick", and a
    // falsy check would hand them the default instead -- the one value in the field
    // that has to work is the one that switch would swallow.
    const set = this.config.stateEvery

    if (set === '' || set === null || set === undefined) return 250

    const every = Number(set)

    if (!Number.isFinite(every) || every < 0) return 250

    // Zero passes through as off. Anything else is held to the floor, so a typed 8
    // is 100 rather than 8 -- and the person who typed it gets the plugin they
    // expected rather than the one that fills a database.
    return every === 0 ? 0 : Math.max(FLOOR_MS, every)
  }

  async receive(raw) {
    const type = raw?.Event
    const data = unwrap(raw?.Data)

    if (!type) return

    if (type === 'UpdateState') {
      this.#tick(data)

      return
    }

    const { name, payload } = normalise(type, data)
    const batched = BATCHED[name]

    if (batched) {
      this.#collect(batched, payload)

      return
    }

    this.emit(name, payload)
  }

  /**
   * Hold onto one fact until the batch goes out.
   *
   * Dated on the way in, because that is the information the batching would
   * otherwise destroy: twelve touches handed over together are a dribble or twelve
   * separate touches depending on when each happened, and by the time the batch
   * arrives there is no way left to tell.
   *
   * No leading edge, unlike the tick. Sending the first one immediately and then
   * batching the rest would mean the common case -- a burst -- still costs two
   * emits where it should cost one.
   */
  #collect(name, payload) {
    const batch = this.#batches.get(name)
    const dated = { ...payload, at: Date.now() }

    if (batch) batch.push(dated)
    else this.#batches.set(name, [dated])

    this.#batch ??= setTimeout(() => this.#drain(), FLOOR_MS)
  }

  /** Hand over everything collected, as one list per event. */
  #drain() {
    clearTimeout(this.#batch)
    this.#batch = null

    for (const [name, items] of this.#batches) {
      this.emit(name, items)
    }

    this.#batches.clear()
  }

  /**
   * The tick, which is the only part of this that needs a policy.
   *
   * Every tick is read. The score comes out of all of them, because a scoreboard a
   * quarter of a second late is a scoreboard that is wrong on the replay -- and
   * because `GoalScored` says who scored and not what the score became. It cannot
   * run away with itself: it fires when a number changes, and in this game those
   * numbers change a few times a match.
   *
   * The state is the sampled one, and it is *collected* rather than dropped -- the
   * newest tick is kept and passed on when the window opens. Sampling by discarding
   * looks the same until the feed stops, and then the last thing a studio was told
   * is whatever arrived on a window boundary rather than what is actually on the
   * pitch. Coalescing costs one held reference and means the final state always
   * lands.
   */
  /*
   * Nothing here emits `'*'` by hand. The emitter fans every event out to wildcard
   * listeners already, prepending the name -- so emitting it again delivered
   * everything twice to anybody taking the whole feed, while `score` and `state`
   * (which never did) arrived once. Two events for one goal reads as the game
   * sending duplicates, which is the kind of thing a studio works around rather
   * than reports.
   */
  #tick(data) {
    const score = scoreOf(data)

    if (!this.#score || this.#score.blue !== score.blue || this.#score.orange !== score.orange) {
      this.#score = score
      this.emit('score', score)
    }

    const every = this.stateEveryMs

    if (!every) return

    // Replaced, not queued. There is no value in yesterday's tick.
    this.#pending = data

    const due = this.#statedAt + every - Date.now()

    // Leading edge, so the first tick of a match is not held back by a window
    // nobody is waiting on.
    if (due <= 0) {
      this.#state()

      return
    }

    this.#flush ??= setTimeout(() => this.#state(), due)
  }

  /** Pass on whatever is held, and open the next window. */
  #state() {
    clearTimeout(this.#flush)
    this.#flush = null

    const data = this.#pending

    this.#pending = null

    if (!data) return

    this.#statedAt = Date.now()

    // Normalising here rather than on arrival is the other half of the saving: at
    // 120Hz this runs ten times a second instead of a hundred and twenty, and the
    // ticks in between cost a parse and a score comparison.
    this.emit('state', gameState(data))
  }

  async close() {
    clearTimeout(this.#flush)
    clearTimeout(this.#batch)
    this.#flush = null
    this.#batch = null
    this.#pending = null
    this.#batches.clear()

    await super.close()
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

    crossbar: 'onCrossbar',

    /** Both arrive as lists of dated facts, at most ten times a second. */
    ballHits: 'onBallHits',
    boostPickups: 'onBoostPickups',

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

  onCrossbar() {}

  onBallHits() {}

  onBoostPickups() {}

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
          'Open Documents\\My Games\\Rocket League\\TAGame\\Config. On Windows that is where the game keeps its settings, and the file to edit is the one in there — not the copy beside the installed game.',
          'Look for a file with StatsAPI in the name. If there is not one, create TAStatsAPI.ini there.',
          'In it, under the [TAGame.MatchStatsExporter_TA] heading, set PacketSendRate to 30 and Port to 49124.',
          'Save the file and start Rocket League. The settings are only read at startup.',
          'Press Save and reconnect here.',
        ],
      },
      { type: 'note', text: 'PacketSendRate of 0 switches the feature off entirely. Anything above about 30 is more than a scoreboard can use.' },
      {
        type: 'note',
        text: 'The address this connects to — localhost:49124 — is confirmed against the game. The file name and the heading above come from the API as it was before v2.72 and are not; if you cannot find them, or the game will not connect, host, port and path are all fields on this panel and can be changed here rather than in the game.',
      },
      {
        type: 'text',
        text: 'Every tick is read whatever these settings say. “Full state every” only controls how often the whole picture is handed on — and since nothing on a stream changes visibly more than ten times a second, 100ms is as fast as it will go.',
      },
      {
        type: 'text',
        text: 'Ball touches and boost pickups arrive the same way, as dated lists ten times a second rather than one event each. A dribble is a touch every few frames, and none of them is worth a graphic — but all of them are worth keeping for the stats afterwards.',
      },
      { type: 'text', text: 'Leave Path blank unless connecting fails — it exists for the case where the endpoint wants one.' },
      { type: 'link', href: 'https://www.rocketleague.com/developer/stats-api', label: 'Psyonix’s Stats API documentation' },
      {
        type: 'text',
        text: 'This needs Rocket League v2.72 or newer, which is when the WebSocket was added. Before that the game only spoke raw TCP, which a browser cannot open at all.',
      },
    ],
    config: [
      { key: 'host', label: 'Host', default: 'localhost', help: 'The machine running the game. Usually this one.' },
      { key: 'port', label: 'Port', type: 'number', default: 49124, help: 'Whatever you set as Port in the ini file.' },
      { key: 'path', label: 'Path', default: '', help: 'Leave blank. Only needed if the endpoint turns out to want one.' },
      {
        key: 'stateEvery',
        label: 'Full state every (ms)',
        type: 'number',
        default: 250,
        help: 'The game ticks up to 120 times a second; this is how often that is passed on. 100 is the fastest allowed, 0 switches it off, and goals and the clock arrive either way.',
      },
    ],
    create: (context) => {
      const plugin = new RocketLeague(context)

      new Handler({ ...context, plugin }).attach(plugin.events)

      return plugin
    },
  })

/** Every event the plugin can emit, for anybody enumerating them. */
export const EMITS = [...new Set([...Object.values(EVENTS).map((entry) => BATCHED[entry.emit] ?? entry.emit), 'score', 'state'])]
