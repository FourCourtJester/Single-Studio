// YOURS — example mutations. Keep, edit or delete them.
// Two examples that ship with the template, to be kept, edited or deleted.
//
// Your own belong in custom.js, or in a file per area of the show as it grows --
// mutations/index.js merges them. See docs/data.md for the whole surface.

export const show = {
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
