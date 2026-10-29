import 'fake-indexeddb/auto'

import { readFileSync } from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createVelcroHost, Doc, urlAssets } from '@single-studio/core/worker'

import { logos, ngs, ngsMutations, NgsHandler } from '../src/index'

// The whole loop through a real host: a panel button or a board mutation, the
// plugin asking the league, the studio's handler writing, the show holding it.
// The unit tests prove each piece; this proves they are wired to each other.

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
const answer = (json, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(json) })

/** The two matches a board might load: one reported, one still to be played. */
const reported = fixture('match')
const upcoming = { ...fixture('matches'), returnObject: fixture('matches').returnObject.find((match) => match.matchId === 'avwymv5o4sbc') }

const league = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const route = new URL(url).pathname.replace(/^\/api\//, '')
      const sent = init.body ? JSON.parse(init.body) : {}

      if (route === 'admin/getSeasonInfo') return answer(fixture('season'))
      if (route === 'division/get/all') return answer(fixture('divisions'))
      if (route === 'team/get/registered') return answer(fixture('registered'))
      if (route === 'schedule/fetch/matches') {
        const all = fixture('matches')

        return answer({ ...all, returnObject: all.returnObject.filter((match) => match.divisionConcat === sent.division) })
      }
      if (route === 'standings/fetch/division') return answer(fixture('standings'))
      if (route === 'schedule/fetch/match') return answer(sent.matchId === 'avwymv5o4sbc' ? upcoming : reported)

      return answer({ message: 'no route' }, 404)
    }),
  )

/** The README's handler, kept in step with it by hand. */
class Heroes extends NgsHandler {
  onSeason({ season, divisions, maps, teams }) {
    this.mutate('set', urlAssets(logos(teams)))
    this.mutate('set', {
      'variables.ngs.season': season,
      'variables.ngs.divisions': divisions.map(({ key, name }) => ({ key, name })),
      'variables.ngs.maps': maps,
    })
  }

  onMatches({ matches }) {
    this.mutate('set', {
      'variables.ngs.matches': matches
        .filter((match) => !match.reported)
        .map(({ id, division, divisionName, round, start, home, away }) => ({
          id,
          division,
          label: `${divisionName} r${round}: ${home?.name ?? 'TBD'} vs ${away?.name ?? 'TBD'}`,
          start,
        })),
    })
  }

  onMatch({ match, standings }) {
    const { home, away } = match

    this.mutate('set', {
      'variables.home.name': home?.name ?? 'TBD',
      'variables.home.short': home?.ticker ?? '',
      'variables.home.logo': home?.logo ?? '',
      'variables.home.record': home?.record ? `${home.record.wins}–${home.record.losses}` : '',
      'variables.away.name': away?.name ?? 'TBD',
      'variables.away.short': away?.ticker ?? '',
      'variables.away.logo': away?.logo ?? '',
      'variables.away.record': away?.record ? `${away.record.wins}–${away.record.losses}` : '',
      'variables.match.bestOf': match.bestOf ?? 3,
      'variables.standings': (standings ?? []).map((row) => `${row.name}\t${row.wins}\t${row.losses}`).join('\n'),
    })
  }
}

const until = async (predicate, why) => {
  const deadline = Date.now() + 2_000

  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${why}`)
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
}

let n = 0

const studio = async () => {
  n += 1

  const made = createVelcroHost({ name: `ngs-host-${n}`, persist: false, mutations: { ...ngsMutations }, plugins: [ngs(Heroes)] })

  await made.started

  return made
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a studio running the plugin', () => {
  it('Fetch season on the panel puts every logo in the image library, under its team’s name', async () => {
    league()
    const made = await studio()

    expect(await made.actPlugin('ngs', 'season')).toEqual({ ok: true })

    expect(Doc.read(made.doc, 'assets.ngs/stormblessed')).toEqual({
      kind: 'url',
      url: 'https://s3.amazonaws.com/ngs-image-storage/Stormblessed_3562.png',
      name: 'Stormblessed',
    })
    // "Pending" has no logo, so no entry that would draw nothing.
    expect(Doc.read(made.doc, 'assets.ngs/pending')).toBeUndefined()
    expect(Doc.read(made.doc, 'variables.ngs.season')).toBe(22)
    expect(Doc.read(made.doc, 'variables.ngs.maps')).toHaveLength(12)
  })

  it('choosing a division offers that division’s matches still to be played', async () => {
    league()
    const made = await studio()

    made.mutate('ngs:matches', { division: 'nexus' })
    await until(() => Doc.read(made.doc, 'variables.ngs.matches'), 'the matches to land')

    const offered = Doc.read(made.doc, 'variables.ngs.matches')

    expect(offered.map((match) => match.id)).toEqual(['avwymv5o4sbc', 'avwymv5o4sbg'])
    expect(offered[1].label).toBe("Nexus r2: TBD vs Durotan's Couch")
  })

  it('loading a match puts both teams and their records on the scoreboard', async () => {
    league()
    const made = await studio()

    made.mutate('ngs:load', { id: '9j1jaymvek8jy8' })
    await until(() => Doc.read(made.doc, 'variables.home.name') === 'Pending', 'the match to land')

    expect(Doc.read(made.doc, 'variables.away.name')).toBe('Hat saika and r')
    expect(Doc.read(made.doc, 'variables.home.record')).toBe('14–2')
    expect(Doc.read(made.doc, 'variables.match.bestOf')).toBe(5)
    expect(Doc.read(made.doc, 'variables.standings').split('\n')[0]).toBe('Stormblessed\t16\t2')
  })
})
