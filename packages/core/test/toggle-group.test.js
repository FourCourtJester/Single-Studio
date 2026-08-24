import { beforeEach, describe, expect, it } from 'vitest'

import { joinGroup, membersOf } from '../src/hooks/useToggleGroup'

// A group works out its own membership from what is on screen, which replaced every
// button being handed the names of every other button. These pin the part with
// behaviour in it; the hook around them is a useEffect and a useCallback.

describe('toggle groups', () => {
  let leave = []

  beforeEach(() => {
    for (const go of leave) go()
    leave = []
  })

  const join = (group, path) => {
    const go = joinGroup(group, path)
    leave.push(go)
    return go
  }

  it('collects everything that joined under one name', () => {
    join('panels', 'toggles.stats')
    join('panels', 'toggles.roster')
    join('panels', 'toggles.bracket')

    expect(membersOf('panels')).toEqual(['toggles.stats', 'toggles.roster', 'toggles.bracket'])
  })

  it('keeps two names apart, so two rows do not interfere', () => {
    join('panels', 'toggles.stats')
    join('feed', 'toggles.replay')

    expect(membersOf('panels')).toEqual(['toggles.stats'])
    expect(membersOf('feed')).toEqual(['toggles.replay'])
  })

  it('drops a member when it leaves the screen', () => {
    join('panels', 'toggles.stats')
    const go = join('panels', 'toggles.roster')

    go()

    expect(membersOf('panels')).toEqual(['toggles.stats'])
  })

  it('counts a re-join once, so a double mount is not two members', () => {
    join('panels', 'toggles.stats')
    join('panels', 'toggles.stats')

    expect(membersOf('panels')).toEqual(['toggles.stats'])
  })

  it('forgets a group once its last member goes', () => {
    const go = join('panels', 'toggles.stats')

    go()

    expect(membersOf('panels')).toEqual([])
  })

  it('is inert without a group name, which is the ungrouped button', () => {
    const go = joinGroup(undefined, 'toggles.lowerthird')

    expect(membersOf(undefined)).toEqual([])
    expect(() => go()).not.toThrow()
  })
})
