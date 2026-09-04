// Everything that can change this studio's state. One entry is one transaction, so
// however many paths a mutation touches, every graphic sees a single change rather
// than a sequence.

export const mutations = {
  /**
   * Fresh series. Two writes from a click handler would put a frame on air with one
   * team's new score beside the other's old one; this lands as one change.
   */
  'match:reset'(ctx) {
    ctx.write([
      ['variables.home.score', 0],
      ['variables.away.score', 0],
    ])
  },
}
