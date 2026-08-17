import { describe, expect, it } from 'vitest'

import { isNullable, isUnder, nameOf, namespaceOf, normalize, toEntries, toPaths } from '../src/velcro/paths'

describe('normalize', () => {
  it('collapses whitespace and empty segments', () => {
    expect(normalize(' variables . home . score ')).toBe('variables.home.score')
    expect(normalize('variables..home')).toBe('variables.home')
  })

  it('rejects unusable paths', () => {
    expect(() => normalize('')).toThrow(/at least one segment/)
    expect(() => normalize('...')).toThrow(/at least one segment/)
    expect(() => normalize(42)).toThrow(/must be a string/)
  })
})

describe('segments', () => {
  it('splits namespace from name', () => {
    expect(namespaceOf('variables.home.score')).toBe('variables')
    expect(nameOf('variables.home.score')).toBe('home.score')
  })
})

describe('isUnder', () => {
  it('matches the prefix itself and descendants', () => {
    expect(isUnder('variables.home.score', 'variables')).toBe(true)
    expect(isUnder('variables', 'variables')).toBe(true)
  })

  it('does not match sibling prefixes that merely share characters', () => {
    expect(isUnder('variablesXtra.home', 'variables')).toBe(false)
    expect(isUnder('toggles.home', 'variables')).toBe(false)
  })
})

describe('isNullable', () => {
  it('treats empty-ish values as absent', () => {
    for (const value of [undefined, null, false, '']) expect(isNullable(value)).toBe(true)
  })

  it('keeps zero, because a score of zero is a real score', () => {
    expect(isNullable(0)).toBe(false)
  })
})

describe('payload coercion', () => {
  it('accepts objects, single pairs, and lists of pairs', () => {
    expect(toEntries({ 'a.b': 1 })).toEqual([['a.b', 1]])
    expect(toEntries(['a.b', 1])).toEqual([['a.b', 1]])
    expect(
      toEntries([
        ['a.b', 1],
        ['c.d', 2],
      ]),
    ).toEqual([
      ['a.b', 1],
      ['c.d', 2],
    ])
  })

  it('normalizes single paths and lists alike', () => {
    expect(toPaths(' a . b ')).toEqual(['a.b'])
    expect(toPaths(['a.b', 'c.d'])).toEqual(['a.b', 'c.d'])
  })
})
