// Studio-supplied mutations. These sit in the same registry as the built-ins and
// are dispatched the same way: `mutate('demo:reset', ...)`.
//
// ctx gives you the Yjs transaction. Reach for ctx.write / ctx.add / ctx.read
// rather than touching the maps directly, so nullable-pruning and counter
// promotion keep working.

export const mutations = {
  /** Fresh match: zero the scores, keep the team names. */
  'demo:reset'(ctx) {
    ctx.write([
      ['variables.home.score', 0],
      ['variables.away.score', 0],
      ['toggles.lowerthird', false],
    ])
  },

  /** End of period: swap ends and clear the shot clock. */
  'demo:swap-ends'(ctx) {
    const pairs = [
      ['variables.home.name', 'variables.away.name'],
      ['variables.home.score', 'variables.away.score'],
    ]

    for (const [a, b] of pairs) {
      const left = ctx.read(a)
      const right = ctx.read(b)

      ctx.write([
        [a, right],
        [b, left],
      ])
    }
  },
}
