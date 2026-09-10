/**
 * What this show can do, beyond setting one value at a time.
 *
 * A mutation is one change on air however many paths it touches, which is the whole
 * reason to write one instead of calling `set` three times from a click handler --
 * three calls are three renders, and the graphics show the gap between them.
 */
export const show = {
  /** A goal: credit it and stop the clock together, so the scoreboard never shows one without the other. */
  'demo:goal'(ctx, { team }) {
    ctx.add(`variables.${team}.score`, 1)
    ctx.write([['timers.game', undefined]])
  },

  /** New period: advance it, clear the clock, leave the scores alone. */
  'demo:period'(ctx) {
    const order = ['1st', '2nd', '3rd', 'OT']
    const now = ctx.read('variables.period')
    const next = order[Math.min(order.indexOf(now) + 1, order.length - 1)] ?? order[0]

    ctx.write([
      ['variables.period', next],
      ['timers.game', undefined],
    ])
  },

  /** Fresh match. Everything the last one left behind, in one change. */
  'demo:reset'(ctx) {
    ctx.write([
      ['variables.home.score', 0],
      ['variables.away.score', 0],
      ['variables.period', '1st'],
      ['timers.game', undefined],
      ['toggles.lowerthird', false],
    ])
  },
}
