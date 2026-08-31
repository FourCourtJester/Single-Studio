// YOURS — your studio's own mutations.
// Your studio's own mutations. This file starts empty on purpose.
//
// A mutation is a named function that changes state -- a reducer, if that is the
// word you know it by. It is registered in mutations/index.js, dispatched by name
// from anywhere in the studio, and runs inside a single Yjs transaction: however
// many paths it touches, every graphic on air sees one change rather than a
// sequence of them. That is the reason to write one instead of calling `set` three
// times from a click handler.
//
//   const mutate = useVelcroMutate()
//   <button onClick={() => mutate('my:example', { team: 'home' })}>Do it</button>
//
// Everything the transaction gives you:
//
//   ctx.read(path)          the current value at a path
//   ctx.collect(prefix)     a collection, as { key: value }
//   ctx.list(prefix, opts)  the same, ordered, as [key, value] entries
//   ctx.write(pairs)        set values; an empty value deletes the path
//   ctx.add(path, n)        add to a counter -- safe when two operators both do
//   ctx.now()               the time in the room, not on this machine
//   ctx.set / append / push / pull / move / patch / replace / ...  any built-in
//   ctx.run(name, payload)  any mutation by name, including your own
//
// Four habits worth having from the first one you write:
//
//   1. Name them `area:verb` -- `roster:add`, `game:score`. The prefix keeps yours
//      from colliding with a built-in, which is legal and almost never intended.
//   2. Use `ctx.add` for anything numeric an operator adjusts. Reading a score,
//      adding to it and writing it back looks identical and quietly turns a
//      conflict-free counter into last-write-wins.
//   3. Use `ctx.now()`, never `Date.now()`, for anything time-shaped. It is the
//      room's clock, so a stored instant means the same moment on every machine.
//   4. Nothing but the store in here. No fetch, no timers, no localStorage --
//      those belong in velcro.worker.js, which then calls a mutation with the
//      result.
//
// See docs/data.md for the whole surface, worked examples, and how to choose
// between an array at one path and a collection when more than one person edits
// the same list.

export const custom = {
  /**
   * A no-op, so there is something here to run before there is something to do.
   *
   * Wire it to a button, press it, and nothing happens -- which is the point: the
   * registration, the dispatch and the round trip into the SharedWorker are all
   * working, and the only thing missing is the body. Replace it with the first
   * thing your show actually needs.
   *
   * `mutate('my:example', { team: 'home' })`
   */
  'my:example'(ctx, payload) {
    // Delete this line and write what should change. For example:
    //
    //   ctx.add(`variables.${payload.team}.score`, 1)
    //   ctx.set({ 'toggles.bigplay': true })
    //
    // Both would land together, as one change on air.
    void ctx
    void payload
  },
}
