import { describe, expect, it } from 'vitest'

import { parseBoard, serializeBoard, sizeBoard } from '../src/toolkits/board'
import { slugify } from '../src/toolkits/slug'

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
