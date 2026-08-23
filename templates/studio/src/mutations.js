// Your studio's own mutations. They join the built-ins in one registry and are
// dispatched the same way: useVelcroMutate()('my:reset').
//
// A mutation is one transaction, so however many paths it touches, the graphics on
// air see one change rather than a sequence of them. That is the main reason to
// write one instead of calling `set` three times from a click handler.
//
//   ctx.read(path)         current value
//   ctx.collect(prefix)    a collection, as { key: value }
//   ctx.list(prefix, opts) the same, ordered, as [key, value] entries
//   ctx.write(pairs)       set values, deleting the empty ones
//   ctx.add(path, n)       add to a counter (safe under concurrent operators)
//   ctx.now()              the time in the room, not on this machine
//   ctx.set/append/push/…  any built-in operation
//   ctx.run(name, payload) any mutation, including your own
//
// See docs/data.md for the whole surface, and for how to choose between an array
// at one path and a collection when more than one person edits the same list.

export const mutations = {
  /** Fresh series: zero the scores, drop the round clock. One change on air. */
  'my:reset'(ctx) {
    ctx.write([
      ['variables.home.score', 0],
      ['variables.away.score', 0],
      ['timers.round', undefined],
    ])
  },

  /**
   * Data from somewhere that is not a person -- a scoring API, a bracket, a socket.
   *
   * Call it from the worker (see velcro.worker.js) and it replicates to every
   * operator exactly like a typed edit. `replace` makes the collection match what
   * arrived: members that changed are written, members that vanished are removed,
   * and members that are identical to what is already stored cost nothing at all --
   * no update to the other machines, and no re-render of what is on air. That is
   * what makes polling on a timer a reasonable thing to do.
   */
  'my:feed'(ctx, game) {
    ctx.write([
      ['variables.home.score', game.home?.points],
      ['variables.away.score', game.away?.points],
      ['variables.period', game.period],
    ])

    ctx.replace({
      path: 'variables.standings',
      values: Object.fromEntries((game.teams ?? []).map((team) => [team.id, team])),
    })
  },
}
