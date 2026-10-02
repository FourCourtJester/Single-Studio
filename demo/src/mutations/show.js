/**
 * What this show can do, beyond setting one value at a time.
 *
 * A mutation is one change on air however many paths it touches, which is the whole
 * reason to write one instead of calling `set` twice from a click handler -- two
 * calls are two renders, and the graphics show the gap between them.
 */
export const show = {
  /**
   * A round won: credit it and move on to the next, together.
   *
   * Two separate writes would put the new score up beside the old round number for
   * a frame -- the scoreboard would briefly claim the round was still being played.
   */
  'demo:round'(ctx, { team }) {
    // Empty is round one, which is what the board's placeholder and the scoreboard's
    // fallback both say. A seed written at start-up would have made it explicit, but
    // every machine starts up before it syncs, so a producer joining mid-match would
    // write round one over round five as often as not.
    const round = Number(ctx.read('variables.round')) || 1

    ctx.add(`variables.${team}.score`, 1)
    ctx.write([['variables.round', round + 1]])
  },

  /**
   * A fresh match: scores to nil, back to round one.
   *
   * The names, logos and colours stay. A new match between the same two teams is
   * the common case, and retyping both is what an operator would otherwise do.
   */
  'demo:reset'(ctx) {
    ctx.write([
      ['variables.home.score', 0],
      ['variables.away.score', 0],
      ['variables.round', 1],
    ])
  },
}
