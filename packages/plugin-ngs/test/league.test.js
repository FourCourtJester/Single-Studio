import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { urlAssets } from '@single-studio/core/worker'

import { apiFrom, detailOf, divisionOf, explain, LEAGUE_API, logos, logoUrl, MAPS, matchOf, standingOf, teamOf } from '../src/league.js'

// Real answers from the league, trimmed, with players' BattleTags replaced.
const recorded = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')).returnObject

const matches = recorded('matches')
const byId = (id) => matches.find((match) => match.matchId === id)

describe('logos', () => {
  it('a stored filename becomes the address the league’s own site draws it from', () => {
    expect(logoUrl('Stormblessed_3562.png')).toBe('https://s3.amazonaws.com/ngs-image-storage/Stormblessed_3562.png')
  })

  it('a filename with spaces and an apostrophe still makes a working address', () => {
    // Real: "Durotan's Couch9326_logo.png". The league's client encodes the whole
    // address with encodeURI, which keeps the apostrophe and escapes the space.
    expect(logoUrl("Durotan's Couch9326_logo.png")).toBe("https://s3.amazonaws.com/ngs-image-storage/Durotan's%20Couch9326_logo.png")
  })

  it('a team with no logo has none, rather than an address that draws nothing', () => {
    expect(logoUrl(null)).toBeNull()
    expect(logoUrl('')).toBeNull()
  })

  it('an address that is already whole is left alone', () => {
    expect(logoUrl('https://s3.amazonaws.com/ngs-image-storage/x.png')).toBe('https://s3.amazonaws.com/ngs-image-storage/x.png')
  })

  it('every logo lands in the image library under its team’s name', () => {
    const teams = recorded('registered').map(teamOf)
    const patch = urlAssets(logos(teams))

    expect(patch['assets.ngs/stormblessed']).toEqual({
      kind: 'url',
      url: 'https://s3.amazonaws.com/ngs-image-storage/Stormblessed_3562.png',
      name: 'Stormblessed',
    })
  })

  it('a team without a logo is not added to the library at all', () => {
    // "Pending" has no logo in season 22.
    const teams = recorded('registered').map(teamOf)

    expect(Object.keys(urlAssets(logos(teams)))).not.toContain('assets.ngs/pending')
    expect(logos(teams).every((entry) => entry.url)).toBe(true)
  })

  it('logos can be filed under a group of the studio’s choosing', () => {
    expect(logos([{ name: 'Stormblessed', logo: 'https://x/s.png' }], { group: 'teams' })[0].key).toBe('teams/Stormblessed')
  })
})

describe('the season', () => {
  it('a team carries what a graphic draws: name, short name, logo and roster', () => {
    const stormblessed = recorded('registered')
      .map(teamOf)
      .find((team) => team.name === 'Stormblessed')

    expect(stormblessed).toMatchObject({
      id: '6a362b988065dc00226934b8',
      ticker: 'BLS',
      division: 'heroic',
      logo: expect.stringMatching(/Stormblessed_3562\.png$/),
    })
    expect(stormblessed.members.length).toBeGreaterThan(0)
    expect(stormblessed.members.every((tag) => /#\d+$/.test(tag))).toBe(true)
  })

  it('a team really called Pending is a team, not a placeholder', () => {
    expect(
      recorded('registered')
        .map(teamOf)
        .find((team) => team.ticker === 'PENDING'),
    ).toMatchObject({ name: 'Pending', division: 'heroic' })
  })

  it('a division is named for the operator and keyed for the league', () => {
    expect(
      recorded('divisions')
        .map(divisionOf)
        .find((division) => division.key === 'heroic'),
    ).toMatchObject({ name: 'Heroic', teams: expect.arrayContaining(['Stormblessed']) })
  })

  it('the map pool is the twelve the league reports matches on', () => {
    expect(MAPS).toHaveLength(12)
    expect(MAPS).toContain('Alterac Pass')
    expect(MAPS).not.toContain('Haunted Mines')
  })
})

describe('a match', () => {
  it('a reported match has both scores, in maps won', () => {
    const match = matchOf(byId('9j1jaymvek8jy8'))

    expect(match).toMatchObject({ reported: true, bestOf: 5, home: { name: 'Pending', score: 2 }, away: { name: 'Hat saika and r', score: 3 } })
  })

  it('an unreported match has no score rather than nil-nil', () => {
    const match = matchOf(byId('avwymv5o4sbc'))

    expect(match.reported).toBe(false)
    expect(match.home.score).toBeNull()
    expect(match.away.score).toBeNull()
  })

  it('a start time arrives as a number a graphic can hand to Date', () => {
    expect(matchOf(byId('9j1jaymvek8jy8')).start).toBe(1793236500000)
  })

  it('a match nobody has scheduled says so, rather than starting in 1970', () => {
    expect(matchOf(byId('9xwoymsi1cx91')).start).toBeNull()
  })

  it('a bracket slot waiting on a team has no side, not a nameless one', () => {
    const slot = matchOf(byId('avwymv5o4sbg'))

    expect(slot.home).toBeNull()
    expect(slot.away).toMatchObject({ name: "Durotan's Couch" })
  })

  it('a match that does not say how many games it is best of is not guessed at', () => {
    expect(matchOf(byId('9xwoymsi1cxeh')).bestOf).toBeNull()
  })

  it('the caster comes with the match when one signed up', () => {
    expect(matchOf(byId('9j1jaymvek8jy8')).caster).toEqual({ name: 'Rakugan The Gorgon', url: 'https://www.twitch.tv/rakuganvt/' })
  })

  it('a reported match says which maps each side banned and who won each game', () => {
    const detail = detailOf(recorded('match'))

    expect(detail.bans).toEqual({ home: ['Braxis Holdout', 'Volskaya Foundry'], away: ['Garden of Terror', 'Sky Temple'] })
    expect(detail.games).toEqual(['away', 'home', 'away', 'home', 'away'])
  })
})

describe('the table', () => {
  it('wins and losses are maps, and the league’s order is kept', () => {
    const table = recorded('standings').map(standingOf)

    expect(table[0]).toMatchObject({ rank: 1, name: 'Stormblessed', points: 30, wins: 16, losses: 2, played: 8 })
    expect(table.map((row) => row.rank)).toEqual([...table.map((row) => row.rank)].sort((a, b) => a - b))
  })

  it('a withdrawn team stays in the table, under the name the league gave it', () => {
    expect(recorded('standings').map(standingOf).at(-1)).toMatchObject({ name: 'Heretics and Heathens (Withdrawn S22)', points: 0 })
  })
})

describe('talking to the league', () => {
  it('a blank address is the league’s own', () => {
    expect(apiFrom('')).toBe(LEAGUE_API)
    expect(apiFrom('  https://example.com/api/  ')).toBe('https://example.com/api')
  })

  it('a refusal says what the league said', () => {
    expect(explain(400, { message: 'matchId - (string) parameter is required' })).toMatch(/matchId - \(string\) parameter is required/)
    expect(explain(503, 'Service Unavailable')).toMatch(/try again/i)
  })
})
