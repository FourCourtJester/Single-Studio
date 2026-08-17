import { describe, expect, it } from 'vitest'

import * as Draft from '../src/studio/draft'

const PATH = 'variables.home.name'

describe('draft', () => {
  it('starts clean', () => {
    expect(Draft.isDirty(Draft.EMPTY)).toBe(false)
    expect(Draft.count(Draft.EMPTY)).toBe(0)
  })

  it('stages a value', () => {
    const draft = Draft.stage(Draft.EMPTY, PATH, 'Broncos')

    expect(Draft.has(draft, PATH)).toBe(true)
    expect(Draft.count(draft)).toBe(1)
  })

  it('does not mutate the draft it is given', () => {
    const before = Draft.stage(Draft.EMPTY, PATH, 'Broncos')

    Draft.stage(before, 'variables.away.name', 'Vandals')

    expect(Draft.count(before)).toBe(1)
  })

  it('drops the edit when a value is typed back to what is stored', () => {
    // Otherwise the board reports an unsaved change that would write nothing.
    const draft = Draft.stage(Draft.EMPTY, PATH, 'Broncos', 'Broncos')

    expect(Draft.isDirty(draft)).toBe(false)
  })

  it('clears an existing edit when it returns to the stored value', () => {
    let draft = Draft.stage(Draft.EMPTY, PATH, 'Bronc', 'Broncos')

    expect(Draft.isDirty(draft)).toBe(true)

    draft = Draft.stage(draft, PATH, 'Broncos', 'Broncos')

    expect(Draft.isDirty(draft)).toBe(false)
  })

  it('stages an empty string, which is a real edit meaning "clear this"', () => {
    const draft = Draft.stage(Draft.EMPTY, PATH, '', 'Broncos')

    expect(Draft.has(draft, PATH)).toBe(true)
    expect(Draft.payload(draft)).toEqual({ [PATH]: '' })
  })

  it('returns the same object when nothing changes, so React can skip a render', () => {
    const draft = Draft.stage(Draft.EMPTY, PATH, 'Broncos')

    expect(Draft.stage(draft, PATH, 'Broncos')).toBe(draft)
    expect(Draft.unstage(draft, 'variables.nope')).toBe(draft)
  })

  it('resolves to the staged value while dirty and the stored one when clean', () => {
    const draft = Draft.stage(Draft.EMPTY, PATH, 'Vandals')

    expect(Draft.resolve(draft, PATH, 'Broncos')).toBe('Vandals')
    expect(Draft.resolve(Draft.EMPTY, PATH, 'Broncos')).toBe('Broncos')
  })

  it('unstages one path without disturbing the others', () => {
    let draft = Draft.stage(Draft.EMPTY, PATH, 'Vandals')

    draft = Draft.stage(draft, 'variables.away.name', 'Broncos')
    draft = Draft.unstage(draft, PATH)

    expect(Draft.paths(draft)).toEqual(['variables.away.name'])
  })

  it('builds one payload for every staged path, so a save is one transaction', () => {
    let draft = Draft.stage(Draft.EMPTY, 'variables.home.name', 'Broncos')

    draft = Draft.stage(draft, 'variables.away.name', 'Vandals')

    // Both names have to land on air in the same frame, not a keystroke apart.
    expect(Draft.payload(draft)).toEqual({
      'variables.home.name': 'Broncos',
      'variables.away.name': 'Vandals',
    })
  })
})
