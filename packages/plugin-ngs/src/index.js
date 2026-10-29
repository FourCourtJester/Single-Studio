import { definePlugin, PluginBase, PluginHandler } from '@single-studio/core/worker'

import { apiFrom, ask, divisionOf, LEAGUE_API, MAPS, matchOf, standingOf, teamOf } from './league.js'

export { apiFrom, divisionOf, explain, LEAGUE_API, logos, logoUrl, MAPS, matchOf, sideOf, standingOf, teamOf } from './league.js'

/**
 * How long one request to the league may take.
 *
 * Twenty seconds rather than the ten a poller gets, because the season's teams with
 * their rosters are a third of a megabyte: 326KB, measured. `fetch` has no deadline
 * of its own, and a request that connects and stalls would leave a button spinning
 * for ever.
 */
const BUDGET_MS = 20_000

/**
 * The Nexus Gaming Series, fetched when the operator asks.
 *
 * Not a poller, though it reads a website. What it brings -- the teams, the
 * schedule, the table -- changes between shows, not during one, and the score is
 * the operator's: it is never asked for. Asking every thirty seconds would be a
 * volunteer league's server answering the same question all night for nothing.
 *
 * It is a waterfall, and each step narrows the next at the league rather than after
 * the download:
 *
 *   season    the number, divisions, teams with logos and rosters, the maps
 *   matches   one division's matches                  -- needs a division
 *   load      one match, with its division's table    -- needs a match
 *
 * Fetch season is a button on the plugin's panel. The other two need a choice, and
 * a panel can hold buttons but not a choice, so they are commands a board's pickers
 * reach through `ask`. Each runs on the machine where it was asked: one request,
 * not a poll, so there is nothing for an owner to dedupe.
 */
class Ngs extends PluginBase {
  /** What `command` takes. */
  static commands = { season: true, matches: true, load: true }

  /** The season the other two are asked about. Learned on first need, then kept. */
  #season = null

  /**
   * Division names by key, `heroic` -> `Heroic`.
   *
   * The two match routes this reads leave the display name out -- 0 of 321 from
   * `schedule/fetch/matches`, none from `schedule/fetch/match` -- so without this a
   * picker offers "nexus r1". Kept from Fetch season, or asked for once (3KB).
   */
  #names = null

  /** What the panel says under the buttons: the last thing fetched, or why it failed. */
  #said = null

  constructor(context = {}) {
    super('ngs')

    this.config = context.config ?? {}
    this.api = apiFrom(this.config.api)
    this.problem = null
  }

  /** Nothing to open. Ready means a press will be answered. */
  start() {
    this.status = 'connected'
  }

  stop() {
    this.status = 'idle'
  }

  get notice() {
    return this.#said ? { text: this.#said } : null
  }

  /** A panel button. Throws, so the panel shows why beside it. */
  act(key) {
    return this.#run(key, {})
  }

  /**
   * The same, from a board: `ctx.ask('ngs', 'load', { id })`.
   *
   * An unknown name throws, as every plugin's `command` does -- it is a typo in a
   * studio's own code. Anything else returns at once and reports through events
   * and the panel, because `ask` is called from inside a mutation, which cannot
   * wait on a network.
   */
  command(name, data = {}) {
    if (!this.constructor.commands[name]) {
      throw new Error(`ngs has no command "${name}"; it accepts ${Object.keys(this.constructor.commands).join(', ')}`)
    }

    this.#run(name, data).catch(() => {})

    return true
  }

  async #run(name, data) {
    try {
      if (name === 'season') await this.#fetchSeason()
      else if (name === 'matches') await this.#fetchMatches(data)
      else if (name === 'load') await this.#load(data?.id)
      else throw new Error(`ngs cannot "${name}"`)

      this.status = 'connected'
      this.problem = null
    } catch (error) {
      const message = error?.message ?? String(error)

      this.status = 'error'
      this.problem = message
      this.#said = null
      this.emit('problem', { status: error?.status ?? null, message })

      throw error
    }
  }

  /** One request, held to the deadline. */
  async #ask(route, options = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), BUDGET_MS)

    try {
      return await ask(this.api, route, { ...options, signal: controller.signal })
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`The league did not answer within ${BUDGET_MS / 1000}s.`)
      if (error?.status) throw error

      // A refused request reaches here as a bare TypeError, "Failed to fetch". The
      // likeliest causes are the operator's network and a typo in the address.
      throw new Error(`Could not reach the league at ${this.api}. Check the network, and the league address if you changed it.`)
    } finally {
      clearTimeout(timer)
    }
  }

  async #currentSeason() {
    if (this.#season === null) {
      const info = await this.#ask('admin/getSeasonInfo')

      this.#season = Number(info?.value) || null
    }

    if (!this.#season) throw new Error('The league did not say which season it is.')

    return this.#season
  }

  async #divisionNames() {
    if (!this.#names) this.#names = new Map((await this.#ask('division/get/all')).map(divisionOf).map((division) => [division.key, division.name]))

    return this.#names
  }

  /** A match named as the operator knows its division. */
  #named(match, names) {
    return { ...match, divisionName: names.get(match.division) ?? match.divisionName }
  }

  async #fetchSeason() {
    // Three requests, together. `team/get/registered` is the big one, 326KB for 52
    // teams with rosters; one request for all of them beats 52 for one each.
    const [info, divisions, teams] = await Promise.all([this.#ask('admin/getSeasonInfo'), this.#ask('division/get/all'), this.#ask('team/get/registered')])

    this.#season = Number(info?.value) || null
    this.#names = new Map((divisions ?? []).map(divisionOf).map((division) => [division.key, division.name]))

    const payload = {
      season: this.#season,
      start: Number(info?.seasonStartDate) || null,
      end: Number(info?.seasonEndDate) || null,
      divisions: (divisions ?? [])
        .filter((division) => division?.public !== false)
        .map(divisionOf)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      teams: (teams ?? []).map(teamOf).sort((a, b) => a.name.localeCompare(b.name)),
      maps: [...MAPS],
    }

    this.#said = `Season ${payload.season}: ${payload.teams.length} teams in ${payload.divisions.length} divisions.`
    this.emit('season', payload)
  }

  /**
   * One division's matches.
   *
   * A division, always: the league filters, so a pick is the 43 matches of Heroic
   * (69KB, 0.6s) rather than all 321 of the season (514KB, 1.6s) filtered here.
   *
   * `schedule/fetch/matches` rather than the route named for scheduled matches,
   * which leaves out every match without a time -- 43 of season 22's 321 -- and
   * ignores the season it is given.
   */
  async #fetchMatches({ division } = {}) {
    if (!division) throw new Error('Choose a division first.')

    const season = await this.#currentSeason()
    const [raw, names] = await Promise.all([this.#ask('schedule/fetch/matches', { body: { season, division } }), this.#divisionNames()])
    const matches = (raw ?? [])
      .map(matchOf)
      .map((match) => this.#named(match, names))
      .sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity) || String(a.id).localeCompare(String(b.id)))

    this.#said = `${matches.length} matches in ${names.get(division) ?? division}, season ${season}.`
    this.emit('matches', { season, division, matches })
  }

  /**
   * One match, and the table its two teams sit in.
   *
   * The table is asked for in the same press because a scoreboard writes a team's
   * name and its record together: one event, so a studio can write both in one
   * transaction and the graphics never show one without the other.
   *
   * A table that will not come is not a reason to lose the match. Cup divisions
   * answer in a different shape, and none existed in season 22 to measure against.
   */
  async #load(id) {
    if (!id) throw new Error('Choose a match first.')

    let raw = null

    try {
      raw = await this.#ask('schedule/fetch/match', { body: { matchId: id } })
    } catch (error) {
      // An id the league does not know is a 400, measured, with no useful message.
      if (error?.status === 400) throw new Error(`The league has no match "${id}". Fetch the matches again and choose from the list.`)
      throw error
    }

    if (!raw) throw new Error(`The league has no match "${id}".`)

    const match = this.#named(matchOf(raw), await this.#divisionNames())
    let standings = null

    if (match.division && match.season) {
      try {
        const rows = await this.#ask('standings/fetch/division', { body: { season: match.season, pastSeason: false, division: match.division } })

        standings = Array.isArray(rows) ? rows.map(standingOf) : null
      } catch {
        standings = null
      }
    }

    const recordOf = (side) => (side && standings ? (standings.find((row) => row.id === side.id) ?? null) : null)

    if (match.home) match.home.record = recordOf(match.home)
    if (match.away) match.away.record = recordOf(match.away)

    this.#said = `Loaded ${match.divisionName} round ${match.round ?? '?'}: ${match.home?.name || 'to be decided'} vs ${match.away?.name || 'to be decided'}${standings ? '' : ', without the table'}.`
    this.emit('match', { match, standings })
  }
}

/**
 * The skeleton a studio fills in.
 *
 * `onSeason({ season, divisions, teams, maps })`, `onMatches({ season, division,
 * matches })`, `onMatch({ match, standings })` and `onProblem({ status, message })`.
 * What each carries is in the README.
 */
export class NgsHandler extends PluginHandler {
  static handles = { season: 'onSeason', matches: 'onMatches', match: 'onMatch', problem: 'onProblem' }

  onSeason() {}

  onMatches() {}

  onMatch() {}

  onProblem() {}
}

/**
 * Mutations that reach the plugin, for a board's buttons and pickers.
 *
 *   createVelcroHost({ mutations: { ...mutations, ...ngsMutations }, plugins: [ngs(MyShow)] })
 *   useVelcroMutate()('ngs:load', { id })
 *
 * They do nothing to the show themselves. They ask, the plugin fetches, and the
 * studio's handler writes what came back.
 */
export const ngsMutations = {
  'ngs:season'(ctx) {
    ctx.ask('ngs', 'season')
  },
  'ngs:matches'(ctx, { division } = {}) {
    if (division) ctx.ask('ngs', 'matches', { division })
  },
  'ngs:load'(ctx, { id } = {}) {
    if (id) ctx.ask('ngs', 'load', { id })
  },
}

/**
 * @param {typeof NgsHandler} [Handler]
 */
export const ngs = (Handler = NgsHandler) =>
  definePlugin({
    name: 'ngs',
    label: 'NGS',
    summary: 'The Nexus Gaming Series: teams, logos, matches and tables, fetched when you ask.',
    help: [
      { type: 'text', text: 'Nothing to set up: the league’s site is public, and nothing here needs a key or a login.' },
      {
        type: 'steps',
        items: [
          'Press Fetch season once a show, or whenever teams change. It brings the season number, the divisions, every team with its logo and roster, and the map pool.',
          'On the board, choose a division. Its matches are fetched.',
          'Choose a match and load it. Its teams and their records come in with it.',
        ],
      },
      { type: 'note', text: 'Scores are kept on the board. This never fetches one.' },
      { type: 'link', href: 'https://nexusgamingseries.org', label: 'Nexus Gaming Series' },
    ],
    config: [
      {
        key: 'api',
        label: 'League address',
        type: 'text',
        placeholder: LEAGUE_API,
        help: 'Leave blank. Only for pointing at a copy of the league’s site.',
      },
    ],
    actions: [{ key: 'season', label: 'Fetch season' }],
    create: (context) => {
      const plugin = new Ngs(context)

      new Handler({ ...context, plugin }).attach(plugin.events)

      return plugin
    },
  })
