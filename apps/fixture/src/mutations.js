// Studio-supplied mutations. These sit in the same registry as the built-ins and
// are dispatched the same way: `mutate('demo:reset', ...)`.
//
// ctx gives you the Yjs transaction. Reach for ctx.write / ctx.add / ctx.read
// rather than touching the maps directly, so nullable-pruning and counter
// promotion keep working.
//
// The point of these two is that they are *one* action to the operator. Clearing
// six paths from six button handlers would put six changes on air at slightly
// different moments; one mutation is one transaction, so the scene changes once.

export const mutations = {
  /** Fresh series: zero the scores, drop the round clock. */
  'demo:reset'(ctx) {
    ctx.write([
      ['variables.home.score', 0],
      ['variables.away.score', 0],
      ['timers.round', undefined],
    ])
  },

  /** Between games: the map and both armies are redrafted, the players are not. */
  'demo:next-game'(ctx) {
    const order = ['Game 1', 'Game 2', 'Game 3', 'Tiebreak']
    const at = order.indexOf(ctx.read('variables.period'))

    ctx.write([
      ['variables.map', undefined],
      ['variables.home.army', undefined],
      ['variables.away.army', undefined],
      ['timers.round', undefined],
      ['variables.period', order.at(Math.min(at + 1, order.length - 1)) ?? order.at(0)],
    ])
  },
}
