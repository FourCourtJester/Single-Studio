# Your own data

Everything a studio holds lives in one store, and everything that changes it is a
**mutation** — a named function you write, registered at startup, dispatched by
name. If you have used Redux, a mutation is a reducer: same idea, same
extensibility, without a store to configure or middleware to thread through.

This page is about writing your own: reading what is already there, combining it
with something new, choosing a shape that survives more than one operator, and
pulling data in from somewhere that is not a person.

- [The shortest version](#the-shortest-version)
- [Where mutations live](#where-mutations-live)
- [What a mutation is given](#what-a-mutation-is-given)
- [Choosing a shape](#choosing-a-shape)
- [The built-in operations](#the-built-in-operations)
- [Data from somewhere else](#data-from-somewhere-else)
- [Nothing is written twice](#nothing-is-written-twice)
- [Sets and maps](#sets-and-maps)

## The shortest version

```js
// src/mutations.js
export const mutations = {
  'my:new-period'(ctx) {
    const period = Number(ctx.read('variables.period') ?? 0)

    ctx.write([
      ['variables.period', String(period + 1)],
      ['timers.round', undefined],
    ])
  },
}
```

```jsx
const mutate = useVelcroMutate()

<button onClick={() => mutate('my:new-period')}>New period</button>
```

That is the whole loop. `ctx.read` gets what is stored, `ctx.write` puts values
back, and the two paths change together — the graphic on air sees one change, not
two.

**One mutation is one transaction.** Six paths written from six button handlers
reach the screen at six slightly different moments; six paths written from one
mutation land as a single frame. That is the main reason to write one at all,
before any question of tidiness.

## Where mutations live

A studio hands its mutations to the host when the worker starts:

```js
// src/velcro.worker.js
import { createVelcroHost } from '@single-studio/core/worker'

import { mutations } from './mutations'

createVelcroHost({ name: STUDIO_ID, mutations, sync: { connect } })
```

They join the built-ins in one registry — `{ ...builtins, ...yours }` — so
`mutate('set', …)` and `mutate('my:new-period')` are the same call through the
same path. Yours can override a built-in by using its name, which is occasionally
what you want and usually a mistake, so prefix them: `my:`, `nfl:`, `feed:`.

Nothing is discovered by scanning folders. If it is not in that object, it does
not exist, and there is no conventional path a file has to sit at.

## What a mutation is given

```js
'my:example'(ctx, payload) {}
```

`payload` is whatever the caller passed. It crosses into the SharedWorker by
structured clone, so it can be objects, arrays, numbers, strings — anything JSON
survives. **It cannot be a function**, which is why the operations below take
`{ where: { team: 'home' } }` rather than a predicate.

`ctx` is the transaction:

| | |
| --- | --- |
| `ctx.read(path)` | The current value at a path. `undefined` if nothing is there. |
| `ctx.collect(prefix)` | Every member of a collection, as `{ key: value }`. |
| `ctx.list(prefix, opts)` | The same, ordered, as `[key, value]` entries. |
| `ctx.write(pairs)` | Apply `[path, value]` pairs. Empty values delete the path. |
| `ctx.add(path, n)` | Add to a counter — safe when two operators do it at once. |
| `ctx.now()` | The time **in the room**, not on this machine. |
| `ctx.<operation>(payload)` | Any built-in below — `ctx.set(…)`, `ctx.append(…)`. |
| `ctx.run(name, payload)` | Any mutation by name, your own included. |
| `ctx.doc` `ctx.state` `ctx.clientId` | The Yjs document underneath, if you need it. |

A mutation of your own is usually two or three built-ins under one name, so they
are on the context rather than behind an import:

```js
'feed:game'(ctx, game) {
  ctx.set({ 'variables.period': game.period })
  ctx.replace({ path: 'variables.standings', values: game.teams })
  ctx.run('my:log', game)
}
```

Still one transaction, however many it calls — three operations, one change on air.
`ctx.set` is always the built-in even if you have named a mutation of your own
`set`; that one is `ctx.run('set', …)`.

Two more things are worth a sentence each.

**`ctx.write` deletes on empty.** `undefined`, `null`, `false` and `''` all mean
"no value", so writing one removes the path rather than storing a blank. A score
of `0` is a real value and survives.

**`ctx.now()` is not `Date.now()`.** In a room with a machine marked as running
OBS, this is that machine's clock. An operator whose laptop is four seconds fast
starting a five-minute break writes a target four seconds early with `Date.now()`,
every screen agrees it is correct, and the break overruns on air. Use `ctx.now()`
for anything time-shaped and the number means the same instant everywhere.

## Choosing a shape

This is the decision that matters, and it is not about tidiness — it is about what
happens when two people touch the same list inside the half-second it takes an
edit to replicate.

| Your data | Store it as | Because |
| --- | --- | --- |
| One value | A path | `variables.home.name` |
| A record with fields | One path per field | `variables.home.name`, `variables.home.score` — fields merge independently |
| A number people adjust | A counter (`ctx.add`) | Two `+1`s make `+2` instead of `+1` |
| A list with **one** author | An array at one path | Ordered, simple, and last-write-wins |
| A list **several people** add to | A collection | One path per member, so concurrent adds both survive |

### Records are just paths

There is no special support for objects because the path *is* the nesting:

```js
ctx.write([
  ['variables.home.name', 'Broncos'],
  ['variables.home.score', 0],
])
```

Two operators editing the name and the score at the same moment both land, because
those are two keys. Had you stored `{ name, score }` at `variables.home`, one of
them would have overwritten the other wholesale. Reach for a single object only
when the thing genuinely is one opaque blob — then `patch` merges into it.

### Lists: the trade, spelled out

An array at one path is the obvious shape and it is genuinely fine for a list with
one author — a feed you poll, a queue one operator runs, a paste from a
spreadsheet. It is ordered, it is easy to read, and it is last-write-wins:

```js
// Two operators, both adding, within the replication window:
ctx.read('variables.queue')   // ['Ada']
// operator A pushes 'Grace', operator B pushes 'Katherine'
// after they sync:  ['Ada', 'Grace']      ← Katherine is gone, silently
```

That is the same failure `+1` and `+1` making `+1` used to be, and it is why
counters exist. For lists the answer is a **collection**: one path per member.

```js
'roster:add'(ctx, player) {
  ctx.append({ path: 'variables.roster', value: player })
}
```

```
variables.roster.00mt5wdvkp-neldej-1   { name: 'Ada' }
variables.roster.00mt5wdvkr-neldej-2   { name: 'Grace' }
variables.roster.00mt5wdvkr-y1p4rb-1   { name: 'Katherine' }
```

A key is a padded timestamp, the client id of whoever wrote it, and a counter —
enough to be unique across machines and to sort back into the order things
happened.

Separate keys in one map merge; a single value replacing itself does not. All
three survive.

Read it back in order:

```jsx
const roster = useVelcroList('variables.roster')

roster.map(([key, player]) => <li key={key}>{player.name}</li>)
```

Entries rather than bare values, because the key is how you address a member again
— to change it or remove it — and hiding that key inside the member would collide
with your own fields. `roster.map(([, player]) => …)` drops it when you do not
care.

**Order comes from the keys.** A generated key starts with a zero-padded
timestamp, so sorting the keys as strings is sorting by when each member was
added, and every peer computes the identical order without exchanging anything.
When the order belongs to the data instead, sort on a field:

```js
useVelcroList('variables.roster', { by: 'seed' })
useVelcroList('variables.roster', { by: 'points', desc: true })
```

Members with nothing to sort on go last, whichever way the list points.

**Naming members yourself** makes an add idempotent, which is what you want when
the data comes from somewhere with its own ids:

```js
ctx.append({ path: 'variables.roster', key: player.id, value: player })
```

The same record arriving twice lands on the same path, and the second time writes
nothing at all.

### Why not a CRDT list

Yjs has `Y.Array`, which would give true concurrent ordered insert. Velcro does not
use one, and the reason is the flat address space: every value in the store is a
plain value at a dot-path, and that is what makes subscriptions a set lookup,
persistence a flat replay, `clear` a filter, and a path something you can type into
a component as a string. A live Yjs type at a path would need its own handling in
all of those, and every studio would then have to know which of its paths were
special.

A collection buys most of what an ordered CRDT list buys — concurrent add and
remove, consistent order everywhere — while staying ordinary values at ordinary
paths. What it does not buy is two operators reordering the *same* list at the same
moment, which resolves last-write-wins on the field being sorted. In a broadcast
studio that has not been worth the rest of the cost.

## The built-in operations

Every one of these is available from `mutate(name, payload)` on a board and as
`ctx.<name>(payload)` inside a mutation. They are listed here by payload.

### Values

| Mutation | Payload | Does |
| --- | --- | --- |
| `set` | `{ 'variables.home.name': 'Broncos' }` | Write paths. Empty values delete. |
| `merge` | `{ 'variables.home.name': maybe }` | Like `set`, but skips empty values instead of deleting. |
| `unset` | `'toggles.lower'` or `['a', 'b']` | Delete paths. |
| `toggle` | `'toggles.lower'` | Flip a boolean. |
| `only` | `{ group: [...], active: 'x' }` | Turn one on, the rest off. |
| `swap` | `['home.name', 'home.score', 'away.score', 'away.name']` | Trade values pairwise, outermost first. |
| `clear` | `{ prefix, except }` | Wipe everything, or everything under a prefix. |

### Counters

| Mutation | Payload | Does |
| --- | --- | --- |
| `increment` | `{ 'variables.home.score': 1 }` | Add. Concurrent adds sum. |
| `decrement` | `{ 'variables.home.score': 1 }` | Subtract. |

### Objects

| Mutation | Payload | Does |
| --- | --- | --- |
| `patch` | `{ path, value }` | Merge fields into the object at a path, leaving the rest. |

One level deep, on purpose. A deep merge has to guess whether a nested object
replaces or merges, and there is no answer that is right for both a settings blob
and a list of players. Velcro's answer to nesting is the path.

### Arrays at one path

| Mutation | Payload | Does |
| --- | --- | --- |
| `push` | `{ path, value }` or `{ path, values: [...] }` | Append. Creates the array if absent. |
| `pull` | `{ path, at }`, `{ path, where }`, `{ path, value }` | Remove by index, by matching fields, or by value. |
| `move` | `{ path, from, to }` | Reorder. |

All three refuse to run on a path holding something that is not an array, rather
than replacing it.

### Collections

| Mutation | Payload | Does |
| --- | --- | --- |
| `append` | `{ path, value }` or `{ path, key, value }` | Add a member. Generated keys sort by insertion. |
| `replace` | `{ path, values: { key: value } }` | Make the collection match exactly. Adds, updates, deletes. |
| `unset` | `'variables.roster.<key>'` | Remove a member — a member is just a path. |

## Data from somewhere else

Not all data is typed by an operator. A scoring API, a bracket service, a socket,
a clock of your own — a studio owns those, and they belong in the worker:

```js
// src/velcro.worker.js
createVelcroHost({
  name: STUDIO_ID,
  mutations,
  sync: { connect },

  onReady({ mutate, owns }) {
    setInterval(async () => {
      if (!owns()) return

      const response = await fetch('https://scores.example.com/live')

      mutate('feed:game', await response.json())
    }, 5000)
  },
})
```

```js
// src/mutations.js
export const mutations = {
  'feed:game'(ctx, game) {
    // Fields the feed owns. An operator's own edits to other paths are untouched.
    ctx.write([
      ['variables.home.score', game.home.points],
      ['variables.away.score', game.away.points],
      ['variables.period', game.period],
    ])

    // The whole table, keyed by the ids the feed already has.
    ctx.replace({
      path: 'variables.standings',
      values: Object.fromEntries(game.teams.map((team) => [team.id, team])),
    })
  },
}
```

Two things in there are the whole point, and both are about how many times this
runs.

**In the worker, not on a board**, because one machine may have five boards open.
A poll started on a page runs once per tab — five fetches, five writes racing for
the same paths. Started here it runs once, because the SharedWorker is the one
thing a machine has exactly one of.

**Behind `owns()`, because one room may have five machines.** That guard is false
once somebody else has ticked *This machine runs OBS* in the Collaborate dialog.
Ingress needs a single owner, and that is the one the room already knows: the
machine that has to display the show is the machine that should be talking to
anybody's API. Everybody else gets the same data a moment later through
replication, for free. Without the guard, a five-operator show is five times the
API quota and five writers on the same paths — and it will look fine in testing,
because you will test it alone.

`owns()` is `true` on a studio that never joined a room, so a one-machine show is
always its own owner.

`onReady` also gives you `sync`, `doc` and `registry`, and it runs after
persistence has replayed — so what you read is the show as it stood, not an empty
document about to be overwritten.

### When it is a connection rather than a poll

A socket, or anything that can drop and needs reconnecting, wants
[`Service`](../packages/core/src/services/Service.js) instead of a bare interval.
It is the same idea with the parts a real connection needs: exponential backoff
rather than a flat retry, a status you can show an operator, and the same ownership
rule expressed as `owner` so it stands down when another machine takes the role.

```js
class ScoresService extends Service {
  static serviceName = 'scores'

  async open() {
    this.socket = new WebSocket(this.config.url)
    this.socket.onmessage = (event) => this.mutate('feed:game', JSON.parse(event.data))
    this.socket.onclose = () => this.dropped()
  }

  async close() {
    this.socket?.close()
  }
}

onReady({ mutate, owns, sync }) {
  const scores = new ScoresService({ mutate, owner: owns, url: 'wss://scores.example.com' })

  scores.start()
  sync.watch(() => scores.recheck())
}
```

## Nothing is written twice

Writing a value that is already there is not free in a CRDT. It appends an item to
the document, sends an update frame to every peer, writes to IndexedDB, and wakes
every observer — which republishes the path and re-renders every graphic holding
it.

So Velcro compares first. **A write whose value is structurally equal to what is
stored does nothing at all**: no frame, no persistence, no re-render.

```js
mutate('set', { 'variables.feed': { home: 1, away: 2 } })
mutate('set', { 'variables.feed': { home: 1, away: 2 } })  // costs nothing
```

The comparison is structural, not by reference, so a fresh object off `JSON.parse`
every poll compares equal to the one before it. `replace` inherits this member by
member: an unchanged table writes nothing, a table where one score moved writes one
member. That is what makes polling a feed every few seconds a reasonable thing to
do rather than something to feel bad about.

The one deliberate exception is an absolute write to a **counter**. Setting a
counter to the value it already reads still clears the per-writer subtotals,
because that is what "the score is 3 now" means — skipping it would leave a
concurrent `+1` resolving against the structure you meant to clear.

## Sets and maps

Values are JSON, so a `Set` or a `Map` does not round-trip as itself. Neither needs
to:

- **A map is a collection.** `{ key: value }` is exactly what `ctx.collect` returns
  and what `replace` takes, with the added property that two operators writing
  different keys both survive — which a `Map` at one path would not give you.
- **A set is a collection whose values you ignore**, or an array at a path if one
  author owns it. `append` with `key` set to the member itself makes adds
  idempotent, which is the set behaviour you actually wanted.

If you genuinely need `Set` semantics in your own code, convert on the way out:
`new Set(Object.keys(ctx.collect('variables.tags')))`.

---

**See also** — [Getting started](getting-started.md) for wiring a studio up,
[Architecture](architecture.md) for why the store is shaped this way, and
[Component reference](api.md) for what reads these values on air.
