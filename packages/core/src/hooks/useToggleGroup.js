import { useCallback, useEffect } from 'react'

// Radio behaviour from a group *name*, rather than from every member spelled out.
//
// It used to be a list: each button was handed the names of every button it had to
// turn off, itself included, and every button in the row had to be given the same
// list. Adding a fourth meant editing four call sites, and getting one of them
// wrong produced a row where most of the buttons behaved and one did not -- which
// is the kind of fault nobody finds until a show.
//
// So a button says which group it is in and nothing else:
//
//   <Toggle name="stats" group="panels" />
//   <Toggle name="roster" group="panels" />
//   <Toggle name="bracket" group="panels" />
//
// The group works out its own membership. Each button registers its path while it
// is on screen, so the set is whatever is actually rendered rather than whatever
// somebody remembered to list.
//
// Module scope rather than a context, because there is no state here a render
// depends on -- the membership is read once, at the moment of a click, and a
// context would mean every button in a row re-rendering whenever any of them
// mounted. One page is one board, so there is nothing to isolate between.
//
// The honest limit: a button that is not rendered is not a member. A group split
// across a collapsed panel will not turn off the half nobody can see, and if that
// matters the value to reach for is the path, not the group -- write the ones you
// mean with `only`.

/** group name -> the paths currently on screen under it. */
const groups = new Map()

/**
 * Join a group. Returns the leave.
 *
 * A plain function rather than only a hook, because this is the part with
 * behaviour worth pinning -- membership, duplicate joins, and cleaning up after
 * the last member -- and testing it should not require a DOM.
 */
export function joinGroup(group, path) {
  if (!group) return () => {}

  const members = groups.get(group) ?? new Set()

  groups.set(group, members)
  members.add(path)

  return () => {
    members.delete(path)

    // Drop the group with its last member, so a board that swaps panels does not
    // accumulate an entry per group it has ever shown.
    if (!members.size) groups.delete(group)
  }
}

/** Every path currently in a group, in the order they joined. */
export const membersOf = (group) => (group ? [...(groups.get(group) ?? [])] : [])

/**
 * Join a group while mounted, and read its members on demand.
 *
 * @param {string} [group] The group's name. Nothing happens without one.
 * @param {string} path This component's full path, e.g. `toggles.stats`.
 * @returns {() => string[]} Every path in the group, read at call time.
 */
export function useToggleGroup(group, path) {
  useEffect(() => joinGroup(group, path), [group, path])

  return useCallback(() => membersOf(group), [group])
}
