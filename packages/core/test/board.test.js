import { describe, expect, it } from 'vitest'

import { parseBoard, serializeBoard, sizeBoard } from '../src/toolkits/board'
import { slugify, titleize } from '../src/toolkits/slug'

const TAB = '\t'

describe('parseBoard', () => {
  it('splits lines into rows keyed by field', () => {
    expect(parseBoard(`Kim${TAB}12\nAlvarez${TAB}9`)).toEqual([
      { name: 'Kim', score: '12' },
      { name: 'Alvarez', score: '9' },
    ])
  })

  it('fills missing trailing columns with empty strings, never undefined', () => {
    // An operator pasting only names must not produce rows a component has to
    // null-check field by field.
    expect(parseBoard('Kim\nAlvarez')).toEqual([
      { name: 'Kim', score: '' },
      { name: 'Alvarez', score: '' },
    ])
  })

  it('trims cells, because pasted data carries stray spaces', () => {
    expect(parseBoard(`  Kim  ${TAB}  12  `)).toEqual([{ name: 'Kim', score: '12' }])
  })

  it('honours custom fields and delimiters', () => {
    expect(parseBoard('Kim,BSU,12', { fields: ['name', 'team', 'score'], delimiter: ',' })).toEqual([{ name: 'Kim', team: 'BSU', score: '12' }])
  })

  it('returns nothing for an empty value', () => {
    expect(parseBoard('')).toEqual([])
    expect(parseBoard(undefined)).toEqual([])
  })
})

describe('serializeBoard', () => {
  it('round-trips through parse unchanged', () => {
    const text = `Kim${TAB}12\nAlvarez${TAB}9`

    expect(serializeBoard(parseBoard(text))).toBe(text)
  })

  it('drops trailing blank rows so the graphic has no dangling gap', () => {
    const rows = [
      { name: 'Kim', score: '12' },
      { name: '', score: '' },
      { name: '', score: '' },
    ]

    expect(serializeBoard(rows)).toBe(`Kim${TAB}12`)
  })

  it('keeps blank rows in the middle, which are usually deliberate spacing', () => {
    const rows = [
      { name: 'Kim', score: '12' },
      { name: '', score: '' },
      { name: 'Alvarez', score: '9' },
    ]

    expect(serializeBoard(rows)).toBe(`Kim${TAB}12\n${TAB}\nAlvarez${TAB}9`)
  })

  it('tolerates missing keys', () => {
    expect(serializeBoard([{ name: 'Kim' }])).toBe(`Kim${TAB}`)
  })

  it('serializes an empty board to an empty string, which deletes the key', () => {
    expect(serializeBoard([])).toBe('')
    expect(serializeBoard([{ name: '', score: '' }])).toBe('')
  })
})

describe('sizeBoard', () => {
  it('pads up so every place is editable before it is filled', () => {
    expect(sizeBoard([{ name: 'Kim', score: '12' }], 3)).toEqual([
      { name: 'Kim', score: '12' },
      { name: '', score: '' },
      { name: '', score: '' },
    ])
  })

  it('trims down to the fixed size', () => {
    const rows = parseBoard(`a${TAB}1\nb${TAB}2\nc${TAB}3`)

    expect(sizeBoard(rows, 2)).toHaveLength(2)
  })
})

describe('slugify', () => {
  it('makes operator free text safe for a filename', () => {
    expect(slugify('Boise State')).toBe('boise-state')
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces')
    expect(slugify('FC St. Pauli!')).toBe('fc-st-pauli')
  })

  it('reduces accented letters to their base form', () => {
    expect(slugify('Atlético Madrid')).toBe('atletico-madrid')
  })

  it('handles nothing without throwing', () => {
    expect(slugify(undefined)).toBe('')
    expect(slugify('')).toBe('')
    expect(slugify('!!!')).toBe('')
  })
})

describe('titleize', () => {
  it('keeps a grouped key grouped', () => {
    // A source key may carry slashes so a studio can file its graphics --
    // `lower-thirds/single`, `game/scoreboard`. In an OBS scene list the group is
    // the useful half, so it survives rather than being mashed into one word.
    expect(titleize('lower-thirds/single')).toBe('Lower Thirds / Single')
    expect(titleize('game/scoreboard')).toBe('Game / Scoreboard')
  })

  // A source is registered under a key that has to survive a URL, so it is written
  // the way a URL wants it. What OBS shows in a scene list, and what an operator
  // reads on the board, is derived from that key rather than declared beside it --
  // one name to keep in step instead of two.

  it('turns a hyphenated key into words', () => {
    expect(titleize('lower-third')).toBe('Lower Third')
  })

  it('leaves a single word alone but for its capital', () => {
    expect(titleize('scoreboard')).toBe('Scoreboard')
  })

  it('treats underscores as breaks too', () => {
    expect(titleize('ticker_bar')).toBe('Ticker Bar')
  })

  it('keeps digits attached to the word they follow', () => {
    expect(titleize('week-1')).toBe('Week 1')
  })

  it('collapses whatever spacing it is handed', () => {
    expect(titleize('  spaced  out ')).toBe('Spaced Out')
  })

  it('has an answer for nothing at all', () => {
    expect(titleize('')).toBe('')
    expect(titleize(undefined)).toBe('')
    expect(titleize(null)).toBe('')
  })

  it('round-trips a slug it was given', () => {
    // The pair has to agree, or a key written by one is unreadable to the other.
    expect(slugify(titleize('lower-third'))).toBe('lower-third')
  })
})
