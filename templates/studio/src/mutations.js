// Your studio's own mutations. They join the built-ins in one registry and are
// dispatched the same way: useVelcroMutate()('my:reset').
//
// ctx.write(pairs)   set values, pruning empty ones
// ctx.add(path, n)   add to a counter (safe under concurrent operators)
// ctx.read(path)     current value

export const mutations = {
  'my:reset'(ctx) {
    ctx.write([
      ['variables.home.score', 0],
      ['variables.away.score', 0],
    ])
  },
}
