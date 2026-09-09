# One plugin asking another

**For folding into [plugins.md](../plugins.md), as a section after "Answering back".**
Written from building it in a real studio rather than proposed: it is what
`SS-BSU-Rocket-League-Esports` does, and it needed no framework change.

## The gap

`handler.command()` reaches the handler's own plugin. That is the right default and
the docs already explain why — the event arrived on the machine running the game, so
the answer goes back down the socket it came in on, and no routing is needed.

It is also only half of what a show does. The commonest integration in broadcast is
one source of truth driving a *different* piece of software:

- Rocket League says a goal went in, and **OBS** cuts to the replay
- a match ends, and **OBS** takes the podium scene
- a spreadsheet changes, and something else has to be told

Today an author who wants that finds `this.command()` on their Rocket League handler,
tries to reach OBS with it, and cannot. There is nothing in the docs telling them what
to do instead, so they invent something — most likely a module-scope singleton the
two handlers both import, which is a back channel around the whole emit/handle design.

## The answer, which already exists

**The mutation registry is the bridge.** It is already "everything this studio can do,
in one object", and everything that might want to ask can already reach it:

| Who | How |
| --- | --- |
| A plugin handler | `this.mutate('obs:scene', { name: 'Podium' })` |
| The operator's board | `useVelcroMutate()('obs:scene', { name: 'Podium' })` |
| Another mutation | `ctx.run('obs:scene', { name: 'Podium' })` |

So a bridge is a file of mutations:

```js
// src/mutations/plugins.js -- generic, one per studio
const running = new Map()

export const usePlugins = (plugins) => {
  running.clear()
  for (const [name, plugin] of plugins ?? []) running.set(name, plugin)
}

export const ask = (plugin, command, data) =>
  Boolean(running.get(plugin)?.command?.(command, data))
```

```js
// src/mutations/obs.js -- one bridge
import { ask } from './plugins'

export const obs = {
  'obs:scene'(ctx, { name } = {}) {
    if (name) ask('obs', 'scene', { name })
  },
}
```

```js
// src/studio/velcro.worker.js -- the only wiring
onReady({ plugins }) {
  usePlugins(plugins)
}
```

That is the whole of it. Any plugin, any command, from anywhere.

## The one thing that cannot be declared

`createVelcroHost` takes `mutations` and `plugins` together, so a mutation written at
module scope has no plugin to close over. `onReady` is handed the live map and is the
first moment one exists — which is why the setter exists at all, and why it is one
line rather than a per-bridge chore.

This is worth saying explicitly in the docs. It is not obvious that `onReady`'s
`plugins` argument is for anything, and it is the seam the whole pattern hangs on.

## Two behaviours worth specifying

**Asking a plugin that is not running is quiet.** A show not driving OBS tonight is
the ordinary case, not a fault, and a studio should not have to guard every call.

**A command the plugin does not take still throws.** That is `command()`'s own
behaviour and it should be preserved through the bridge: it is a typo in studio code,
and the far end would swallow the frame without a word.

## The objection, which should be answered in the docs rather than left to be found

[data.md](../data.md) says, in bold:

> **Nothing but the store.** No `fetch`, no `Date.now()`, no writing to `localStorage`
> inside a mutation. A mutation runs inside a Yjs transaction and its whole job is to
> change state; anything with a wait in it belongs in the worker's `onReady`.

A command is not a wait. It is one frame written to a socket that is already open; it
returns a boolean rather than a promise; and it answers `false` rather than throwing
when this machine does not hold the role, so on a collaborating show it guards itself.
The reason behind the rule — that a mutation must not block a transaction — is intact.

But the rule as written forbids it, and an author who reads `data.md` carefully will
conclude the pattern is wrong. **That is the documentation gap**: either the rule gains
an explicit exception for commands, or the pattern needs a different home.

## The alternative considered

Give handlers the registry, so `this.plugins.obs.command(...)` is legitimate.

It is more honest in one way — a command is not a state change, and routing it through
something called a mutation is a slight lie. It is worse in two: it couples every
handler to the names of plugins it does not own, and it puts a second mechanism beside
a registry that already exists and is already reachable from the board, which the
plugin route is and this is not.

Worth recording the trade rather than only the conclusion, in case the balance changes.

## What this would need in the framework

Nothing. That is the argument for documenting it rather than building anything.

If it is worth going further, the smallest useful additions would be:

1. **A worked bridge in `plugins.md`**, which is what this file is for.
2. **A note on `onReady`'s `plugins` argument** in `data.md` or `getting-started.md`,
   since nothing currently says what it is for.
3. **The exception in `data.md`'s "Nothing but the store"** — a sentence, so that
   following the docs carefully and doing the right thing stop being in tension.
