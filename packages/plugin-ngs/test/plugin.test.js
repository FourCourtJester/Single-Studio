import { readFileSync } from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ngs, ngsMutations, NgsHandler } from '../src/index'

const body = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))

const answer = (status, json) => ({ ok: status < 400, status, text: async () => JSON.stringify(json) })

/**
 * A league that answers from the recordings, and remembers what it was asked.
 *
 * Keyed on the route and the request body, so a request for the wrong season or
 * the wrong match gets nothing rather than a convincing answer.
 */
const league = (over = {}) => {
  const asked = []
  const routes = {
    'admin/getSeasonInfo': () => answer(200, body('season')),
    'division/get/all': () => answer(200, body('divisions')),
    'team/get/registered': () => answer(200, body('registered')),
    // Filtered by division as the league filters it, so a plugin that fetched the
    // season and filtered here would get a different answer from one that asked.
    'schedule/fetch/matches': (sent) => {
      if (sent?.season !== 22) return answer(400, { message: 'season - (number) parameter is required' })

      const all = body('matches')

      return answer(200, { ...all, returnObject: all.returnObject.filter((match) => !sent.division || match.divisionConcat === sent.division) })
    },
    'schedule/fetch/match': (sent) => (sent?.matchId === '9j1jaymvek8jy8' ? answer(200, body('match')) : answer(400, { message: 'Bad Request' })),
    'standings/fetch/division': (sent) =>
      sent?.season === 22 && sent?.division === 'heroic' ? answer(200, body('standings')) : answer(500, { message: 'nope' }),
    ...over,
  }

  const fetch = vi.fn(async (url, init = {}) => {
    const route = new URL(url).pathname.replace(/^\/api\//, '')
    const sent = init.body ? JSON.parse(init.body) : null

    asked.push({ route, sent, method: init.method ?? 'GET' })

    return routes[route] ? routes[route](sent) : answer(404, { message: 'no route' })
  })

  vi.stubGlobal('fetch', fetch)

  return { asked, fetch }
}

/** A studio's handler that records what it was told. */
const watching = () => {
  const told = { season: [], matches: [], match: [], problem: [] }

  class MyShow extends NgsHandler {
    onSeason(payload) {
      told.season.push(payload)
    }

    onMatches(payload) {
      told.matches.push(payload)
    }

    onMatch(payload) {
      told.match.push(payload)
    }

    onProblem(payload) {
      told.problem.push(payload)
    }
  }

  return { MyShow, told }
}

const build = (Handler = NgsHandler, config = {}) => {
  const plugin = ngs(Handler).create({ mutate: vi.fn(), owner: () => true, studio: 's', config })

  plugin.start()

  return plugin
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetching the season', () => {
  it('Fetch season brings the season number, divisions, teams with logos, and the maps', async () => {
    league()
    const { MyShow, told } = watching()

    await build(MyShow).act('season')

    const [season] = told.season

    expect(season.season).toBe(22)
    expect(season.divisions.map((division) => division.key)).toEqual(['heroic', 'nexus', 'b-east'])
    expect(season.teams.map((team) => team.name)).toEqual(['Hat saika and r', 'Pending', 'Stormblessed'])
    expect(season.teams.find((team) => team.name === 'Stormblessed').logo).toMatch(/^https:\/\/s3\.amazonaws\.com\/ngs-image-storage\//)
    expect(season.maps).toHaveLength(12)
  })

  it('the panel says what was fetched', async () => {
    league()
    const plugin = build()

    await plugin.act('season')

    expect(plugin.notice.text).toBe('Season 22: 3 teams in 3 divisions.')
    expect(plugin.status).toBe('connected')
  })

  it('asks the league the way it was measured to answer', async () => {
    const { asked } = league()

    await build().act('season')

    expect(asked.map((request) => `${request.method} ${request.route}`).sort()).toEqual([
      'GET admin/getSeasonInfo',
      'GET division/get/all',
      'GET team/get/registered',
    ])
  })
})

describe('choosing a division', () => {
  it('the panel offers only Fetch season; matches need a division, which is the board’s to choose', () => {
    league()

    expect(ngs().actions.map((action) => action.key)).toEqual(['season'])
  })

  it('choosing a division asks the league for that division’s matches and no others', async () => {
    const { asked } = league()
    const { MyShow, told } = watching()

    build(MyShow).command('matches', { division: 'nexus' })
    await vi.waitFor(() => expect(told.matches).toHaveLength(1))

    // The season was not known, so it was asked for first.
    expect(asked.map((request) => request.route)).toEqual(['admin/getSeasonInfo', 'schedule/fetch/matches', 'division/get/all'])
    expect(asked[1].sent).toEqual({ season: 22, division: 'nexus' })
    expect(told.matches[0].division).toBe('nexus')
    expect(new Set(told.matches[0].matches.map((match) => match.division))).toEqual(new Set(['nexus']))
  })

  it('with no division chosen nothing is fetched, and the panel says to choose one', async () => {
    const { asked } = league()
    const { MyShow, told } = watching()
    const plugin = build(MyShow)

    plugin.command('matches', {})
    await vi.waitFor(() => expect(told.problem).toHaveLength(1))

    expect(asked).toHaveLength(0)
    expect(told.problem[0].message).toBe('Choose a division first.')
  })

  it('once the season is fetched, a division is one request', async () => {
    const { asked } = league()
    const { MyShow, told } = watching()
    const plugin = build(MyShow)

    await plugin.act('season')
    asked.length = 0

    plugin.command('matches', { division: 'heroic' })
    await vi.waitFor(() => expect(told.matches).toHaveLength(1))

    expect(asked).toEqual([{ route: 'schedule/fetch/matches', sent: { season: 22, division: 'heroic' }, method: 'POST' }])
  })

  it('a match is named by its division as the operator knows it, which the league’s match routes leave out', async () => {
    league()
    const { MyShow, told } = watching()
    const plugin = build(MyShow)

    plugin.command('matches', { division: 'heroic' })
    await vi.waitFor(() => expect(told.matches).toHaveLength(1))

    expect(told.matches[0].matches.find((match) => match.id === '9j1jaymvek8jy8').divisionName).toBe('Heroic')

    plugin.command('load', { id: '9j1jaymvek8jy8' })
    await vi.waitFor(() => expect(told.match).toHaveLength(1))

    expect(told.match[0].match.divisionName).toBe('Heroic')
  })

  it('matches come soonest first, with the unscheduled ones last', async () => {
    league({
      // Every division at once, so there is an unscheduled match to sort.
      'schedule/fetch/matches': () => answer(200, body('matches')),
    })
    const { MyShow, told } = watching()

    build(MyShow).command('matches', { division: 'any' })
    await vi.waitFor(() => expect(told.matches).toHaveLength(1))

    const starts = told.matches[0].matches.map((match) => match.start)

    expect(starts.at(-1)).toBeNull()
    expect(starts.filter((start) => start !== null)).toEqual([...starts.filter((start) => start !== null)].sort((a, b) => a - b))
  })
})

describe('loading a match', () => {
  it('a chosen match arrives with its division’s table and each side’s record', async () => {
    league()
    const { MyShow, told } = watching()
    const plugin = build(MyShow)

    expect(plugin.command('load', { id: '9j1jaymvek8jy8' })).toBe(true)
    await vi.waitFor(() => expect(told.match).toHaveLength(1))

    const [{ match, standings }] = told.match

    expect(match).toMatchObject({ id: '9j1jaymvek8jy8', division: 'heroic', home: { name: 'Pending' }, away: { name: 'Hat saika and r' } })
    expect(match.home.record).toMatchObject({ rank: 2, points: 28 })
    expect(match.away.record).toMatchObject({ rank: 3, points: 25 })
    expect(standings[0]).toMatchObject({ name: 'Stormblessed', rank: 1 })
  })

  it('a match whose table will not come still loads, and the panel says it came without one', async () => {
    league({ 'standings/fetch/division': () => answer(500, { message: 'down' }) })
    const { MyShow, told } = watching()
    const plugin = build(MyShow)

    plugin.command('load', { id: '9j1jaymvek8jy8' })
    await vi.waitFor(() => expect(told.match).toHaveLength(1))

    expect(told.match[0].standings).toBeNull()
    expect(told.match[0].match.home.record).toBeNull()
    expect(plugin.notice.text).toMatch(/without the table/)
  })

  it('a match the league does not know says so, and nothing is written', async () => {
    league()
    const { MyShow, told } = watching()
    const plugin = build(MyShow)

    plugin.command('load', { id: 'not-a-match' })
    await vi.waitFor(() => expect(told.problem).toHaveLength(1))

    expect(told.match).toHaveLength(0)
    expect(told.problem[0].message).toMatch(/no match "not-a-match"/)
    expect(plugin.status).toBe('error')
    expect(plugin.problem).toMatch(/no match/)
  })
})

describe('when the league is not there', () => {
  it('a press that cannot reach the league says so beside the button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    const plugin = build()

    await expect(plugin.act('season')).rejects.toThrow(/Could not reach the league at https:\/\/nexusgamingseries\.org\/api/)
    expect(plugin.status).toBe('error')
  })

  it('a league that stops answering is given up on, not waited for all night', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          }),
      ),
    )

    try {
      const pressed = build().act('season')
      const settled = expect(pressed).rejects.toThrow(/did not answer within 20s/)

      await vi.advanceTimersByTimeAsync(20_000)
      await settled
    } finally {
      vi.useRealTimers()
    }
  })

  it('the board can point it at another address', async () => {
    const { asked } = league()

    vi.mocked(fetch).mockImplementationOnce(async (url) => {
      asked.push({ url: String(url) })

      return answer(200, body('season'))
    })

    build(NgsHandler, { api: 'https://example.com/api/' }).command('season')
    await vi.waitFor(() => expect(asked.length).toBeGreaterThan(0))

    expect(asked[0].url).toBe('https://example.com/api/admin/getSeasonInfo')
  })
})

describe('from a board', () => {
  it('a command the plugin does not take throws, naming the ones it does', () => {
    league()

    expect(() => build().command('teleport')).toThrow(/accepts season, matches, load/)
  })

  it('the board’s mutations ask the plugin and write nothing themselves', () => {
    const ask = vi.fn()
    const ctx = { ask, set: vi.fn(), get: vi.fn() }

    ngsMutations['ngs:season'](ctx)
    ngsMutations['ngs:matches'](ctx, { division: 'heroic' })
    ngsMutations['ngs:matches'](ctx, {})
    ngsMutations['ngs:load'](ctx, { id: '9j1jaymvek8jy8' })
    ngsMutations['ngs:load'](ctx, {})

    expect(ask.mock.calls).toEqual([
      ['ngs', 'season'],
      ['ngs', 'matches', { division: 'heroic' }],
      ['ngs', 'load', { id: '9j1jaymvek8jy8' }],
    ])
    expect(ctx.set).not.toHaveBeenCalled()
  })
})
