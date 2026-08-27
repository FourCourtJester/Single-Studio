import { describe, expect, it } from 'vitest'

import { explain, keyOf, parse, same, urlFor } from '../src/sheet'

describe('column names', () => {
  it('become keys somebody would type', () => {
    // A graphic writing row['Team Name'] breaks when somebody tidies the
    // capitalisation of a spreadsheet. A key does not.
    expect(keyOf('Team Name')).toBe('teamName')
    expect(keyOf('Points')).toBe('points')
    expect(keyOf('Goal Difference')).toBe('goalDifference')
  })

  it('survive punctuation and spacing an operator will actually use', () => {
    expect(keyOf('  Wins / Losses  ')).toBe('winsLosses')
    expect(keyOf('Player #1')).toBe('player1')
  })

  it('give an unnamed column a name of its own rather than colliding on empty', () => {
    expect(keyOf('', 0)).toBe('column1')
    expect(keyOf('   ', 3)).toBe('column4')
  })
})

describe('parsing', () => {
  const body = {
    values: [
      ['Team', 'Points', 'Played'],
      ['Broncos', '12', '5'],
      ['Vandals', '9', '5'],
    ],
  }

  it('reads the first row as headings by default', () => {
    const { rows, header, count } = parse(body)

    expect(header).toEqual(['team', 'points', 'played'])
    expect(count).toBe(2)
    expect(rows[0]).toEqual({ team: 'Broncos', points: '12', played: '5' })
  })

  it('hands back the grid when a sheet has no headings', () => {
    const { rows, header } = parse(body, { header: false })

    expect(header).toBeNull()
    expect(rows[0]).toEqual(['Team', 'Points', 'Played'])
  })

  it('pads the short rows the API sends back', () => {
    // Trailing empty cells are omitted rather than padded, so reading by index
    // silently shifts every value left of a gap.
    const ragged = { values: [['Team', 'Points', 'Played'], ['Broncos', '12'], ['Vandals']] }
    const { rows } = parse(ragged)

    expect(rows[0]).toEqual({ team: 'Broncos', points: '12', played: '' })
    expect(rows[1]).toEqual({ team: 'Vandals', points: '', played: '' })
  })

  it('drops the blank rows people leave as spacers', () => {
    // Emitting one puts an empty name on air.
    const spaced = {
      values: [
        ['Team', 'Points'],
        ['Broncos', '12'],
        ['', ''],
        ['Vandals', '9'],
      ],
    }

    expect(parse(spaced).count).toBe(2)
  })

  it('is empty rather than broken when the range has nothing in it', () => {
    expect(parse({})).toEqual({ rows: [], header: [], count: 0 })
    expect(parse({ values: [] }).count).toBe(0)
  })
})

describe('deciding whether to say anything', () => {
  it('is the whole reason polling is cheap', () => {
    // An unchanged sheet emits nothing, so a studio's handler and every mutation it
    // would make run only when somebody has actually edited something.
    const one = parse({ values: [['A'], ['1']] })
    const two = parse({ values: [['A'], ['1']] })

    expect(same(one, two)).toBe(true)
  })

  it('notices an edit anywhere in the grid', () => {
    const before = parse({
      values: [
        ['A', 'B'],
        ['1', '2'],
      ],
    })

    expect(
      same(
        before,
        parse({
          values: [
            ['A', 'B'],
            ['1', '3'],
          ],
        }),
      ),
    ).toBe(false)
    expect(
      same(
        before,
        parse({
          values: [
            ['A', 'B'],
            ['1', '2'],
            ['4', '5'],
          ],
        }),
      ),
    ).toBe(false)
    expect(
      same(
        before,
        parse({
          values: [
            ['A', 'C'],
            ['1', '2'],
          ],
        }),
      ),
    ).toBe(false)
  })
})

describe('the request', () => {
  it('asks for what the operator typed, not what Google would compute', () => {
    // UNFORMATTED_VALUE hands back serial dates and bare numbers. What is in the
    // cell is what an operator expects on air, currency symbols and all.
    expect(urlFor({ id: 'abc', range: 'Standings!A1:D20', key: 'k' })).toContain('valueRenderOption=FORMATTED_VALUE')
  })

  it('escapes a range with a sheet name in it', () => {
    const url = urlFor({ id: 'abc', range: 'My Sheet!A1:B2', key: 'k' })

    expect(url).toContain('/values/My%20Sheet!A1%3AB2')
  })

  it('reads the whole thing when no range is given', () => {
    expect(urlFor({ id: 'abc', key: 'k' })).toContain('/values/A%3AZ')
  })

  it('says what is missing rather than building a URL that will 404', () => {
    expect(() => urlFor({ key: 'k' })).toThrow(/spreadsheet id/)
    expect(() => urlFor({ id: 'abc' })).toThrow(/API key/)
  })
})

describe('explaining a refusal', () => {
  it('names the sharing setting, which is the actual fix', () => {
    // "The caller does not have permission" is accurate and does not tell an
    // operator mid-show that one dropdown fixes it.
    expect(explain(403, { error: { message: 'The caller does not have permission' } })).toMatch(/anyone with the link/)
  })

  it('separates a bad key from a private sheet, because the fixes differ', () => {
    expect(explain(403, { error: { message: 'API key not valid. Please pass a valid API key.' } })).toMatch(/API key was refused/)
  })

  it('reads a 404 as the id and a 400 as the range', () => {
    expect(explain(404, {})).toMatch(/spreadsheet with that id/)
    expect(explain(400, { error: { message: 'Unable to parse range: Nope!!' } })).toMatch(/A1 notation/)
  })

  it('says to poll less often on a rate limit', () => {
    expect(explain(429, {})).toMatch(/less often/)
  })

  it('falls back to what Google said rather than inventing something', () => {
    expect(explain(500, { error: { message: 'Backend error' } })).toBe('Backend error')
    expect(explain(500, {})).toBe('Google answered 500.')
  })
})
