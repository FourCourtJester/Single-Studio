import { describe, expect, it } from 'vitest'

import { qualify } from '../src/toolkits/address'

// The components that act on several values at once used to take fully-qualified
// paths while every other component took a bare name, so the same value was written
// two ways within a few lines of the same panel. This is what makes one way work.

describe('naming several values at once', () => {
  it('resolves bare names against the namespace, like every single-value component', () => {
    expect(qualify({ names: ['home.score', 'away.score'], namespace: 'variables' })).toEqual(['variables.home.score', 'variables.away.score'])
  })

  it('defaults to variables, which is where a studio author is nine times out of ten', () => {
    expect(qualify({ names: ['home.score'] })).toEqual(['variables.home.score'])
  })

  it('takes a lone name without an array, because one is the common case', () => {
    expect(qualify({ names: 'home.score' })).toEqual(['variables.home.score'])
  })

  it('still passes fully-qualified paths through, so nothing written before this broke', () => {
    expect(qualify({ paths: ['variables.home.score'] })).toEqual(['variables.home.score'])
  })

  it('takes both at once, which is the only way to reach across namespaces', () => {
    // Clearing a toggle and the value it was showing, in one button. Names cannot
    // express that on their own, and making it a special case would put the old
    // inconsistency back under a different name.
    expect(qualify({ names: ['lowerthird'], paths: ['variables.guest.name'], namespace: 'toggles' })).toEqual(['toggles.lowerthird', 'variables.guest.name'])
  })

  it('ignores blanks rather than addressing a namespace root', () => {
    // `['']` would qualify to `variables`, which is not a path anybody meant and
    // would clear on a prefix. Silence is the safe reading of an empty entry.
    expect(qualify({ names: ['', '  ', 'home.score'] })).toEqual(['variables.home.score'])
    expect(qualify({})).toEqual([])
    expect(qualify()).toEqual([])
  })
})
