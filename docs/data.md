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
- [Worked examples](#worked-examples)
- [Conventions worth following](#conventions-worth-following)
- [Sets and maps](#sets-and-maps)

## The shortest version

```js
// src/mutations/custom.js
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

As a show grows, split them by area and merge in one place. The template starts
this way, with a no-op in `custom.js` waiting to be filled in:

```js
// src/mutations/index.js
import { custom } from './custom'
import { roster } from './roster'
import { scoring } from './scoring'

export const mutations = { ...roster, ...scoring, ...custom }
```

It is still one object. This file is then the list of everything your studio can
do, which is a useful thing to be able to read in one screen.

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
| `swap` | `['home.name', 'home.score', 'away.name', 'away.score']` | Cut the list in half; the halves trade position for position. |
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
// src/mutations/custom.js
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

## Worked examples

Three pieces of custom work, each end to end: the mutation, the control an
operator drives it with, and the graphic that goes on air. They are written the
way a studio should be written, and between them they use every pattern this page
recommends.

### A roster several operators build

A production assistant is adding players while the director is fixing a spelling.
Both are editing one list at the same time, which is the case a collection exists
for.

```js
// src/mutations/roster.js
export const roster = {
  /**
   * `mutate('roster:add', { name: 'Ada Lovelace', seed: 3 })`
   *
   * A generated key, because two people adding different players at the same
   * moment must both survive -- and neither of them has an id to offer.
   */
  'roster:add'(ctx, player) {
    if (!player?.name) return

    ctx.append({ path: 'variables.roster', value: { name: player.name, seed: player.seed ?? null } })
  },

  /** `mutate('roster:drop', 'ky3m…')` -- a member is just a path. */
  'roster:drop'(ctx, key) {
    ctx.unset(`variables.roster.${key}`)
  },

  /**
   * `mutate('roster:rename', { key: 'ky3m…', name: 'Ada King' })`
   *
   * `patch` rather than `append` with the same key: it merges, so a seed set by
   * somebody else a second ago is still there afterwards.
   */
  'roster:rename'(ctx, { key, name }) {
    ctx.patch({ path: `variables.roster.${key}`, value: { name } })
  },
}
```

The control. `useVelcroList` gives entries, so the key needed to drop a row is
right there beside the row:

```jsx
// src/control/Roster.jsx
import { Panel, useVelcroList, useVelcroMutate } from '@single-studio/core'
import { useState } from 'react'

export function Roster() {
  const players = useVelcroList('variables.roster', { by: 'seed' })
  const mutate = useVelcroMutate()
  const [name, setName] = useState('')

  const add = () => {
    mutate('roster:add', { name })
    setName('')
  }

  return (
    <Panel title="Roster">
      <div className="flex gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} />
        <button onClick={add}>Add</button>
      </div>

      <ol>
        {players.map(([key, player]) => (
          <li key={key}>
            {player.name}
            <button onClick={() => mutate('roster:drop', key)} aria-label={`Remove ${player.name}`}>
              ×
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
```

And the graphic, sorted the same way by the same function, so the two cannot
disagree about the order:

```jsx
// src/sources/Roster.jsx
import { Scene, Toggle, useVelcroList } from '@single-studio/core'

export default function Roster() {
  const players = useVelcroList('variables.roster', { by: 'seed' })

  return (
    <Scene className="flex items-end p-12">
      <Toggle name="roster" transition="slide-up ease-back">
        <ol className="rounded-lg bg-slate-950/90 p-4 text-white">
          {players.map(([key, player]) => (
            <li key={key}>{player.name}</li>
          ))}
        </ol>
      </Toggle>
    </Scene>
  )
}
```

Note what the graphic does *not* do: no `namespace`, no store wiring, no loading
flag. `Toggle` holds it off air until an operator asks for it, and the list is
whatever the store says at that instant.

### A sponsor queue one operator runs

The opposite shape, and the reason both exist. One person owns the running order
of the sponsor bumpers. Nobody else is editing it, order is the whole point, and
an array at one path is simpler than a collection in every way that matters here.

```js
// src/mutations/sponsors.js
export const sponsors = {
  /** `mutate('sponsors:queue', 'asset:acme-logo')` */
  'sponsors:queue'(ctx, slot) {
    ctx.push({ path: 'variables.sponsors', value: slot })
  },

  /** `mutate('sponsors:drop', 2)` */
  'sponsors:drop'(ctx, at) {
    ctx.pull({ path: 'variables.sponsors', at })
  },

  /** `mutate('sponsors:move', { from: 3, to: 0 })` -- drag to reorder. */
  'sponsors:move'(ctx, { from, to }) {
    ctx.move({ path: 'variables.sponsors', from, to })
  },

  /**
   * `mutate('sponsors:advance')`
   *
   * Rotate the queue and put the new front slot on air. Two paths, one mutation,
   * so the graphic swaps once rather than blanking and then filling.
   */
  'sponsors:advance'(ctx) {
    const queue = ctx.read('variables.sponsors') ?? []

    if (queue.length < 2) return

    const rotated = [...queue.slice(1), queue[0]]

    ctx.write([
      ['variables.sponsors', rotated],
      ['variables.sponsor.current', rotated[0]],
    ])
  },
}
```

If a second person ever does start editing that queue, this is the shape that
loses one of their edits — and the fix is `append` into a collection, not a
cleverer array.

### A scoring play that changes four things

The pattern to copy when an operator presses one button and the show has to change
in several ways at once.

```js
// src/mutations/scoring.js
export const scoring = {
  /**
   * `mutate('game:score', { team: 'home', points: 3 })`
   *
   * Four changes, one transaction, so the scoreboard, the clock and the play log
   * reach air together instead of over the next half-second.
   */
  'game:score'(ctx, { team, points = 1 }) {
    // A counter, not a read-add-write. Two operators both crediting a basket
    // inside the replication window have to make six points, not three.
    ctx.add(`variables.${team}.score`, points)

    // Stop the game clock where it stands.
    ctx.stopwatch({ 'timers.game': 'pause' })

    // Log it. A collection, because the log is a list that grows and the OBS
    // machine may be appending a feed event to it at the same moment.
    ctx.append({
      path: 'variables.plays',
      value: { team, points, at: ctx.now(), period: ctx.read('variables.period') ?? '1' },
    })

    // And light the graphic that celebrates it.
    ctx.set({ 'toggles.bigplay': true })
  },
}
```

```jsx
<button onClick={() => mutate('game:score', { team: 'home', points: 3 })}>+3 Home</button>
```

Three things in there are the habits worth taking:

- **`ctx.add`, never read-then-write.** `ctx.write([['…score', ctx.read('…score') + 3]])` looks identical and quietly turns a counter back into last-write-wins — two operators crediting at once and one of the baskets vanishes.
- **`ctx.now()`, never `Date.now()`.** The stamp on that play means the same instant on every machine in the room, including the one whose clock is four seconds out.
- **The name is the operator's intent.** `game:score`, not `set-score-and-pause-and-log`. When the celebration graphic changes next season, the button does not.

## Conventions worth following

**Name them `area:verb`.** `roster:add`, `game:score`, `feed:game`. The prefix
keeps a studio's mutations from colliding with the built-ins — which is legal, and
almost never what somebody meant.

**Payloads follow the built-ins.** Writing paths takes `{ path: value }`, the same
shape as `set`. Everything else takes named arguments — `{ path, from, to }` —
because positional arguments stop being readable at the second one and cannot grow
a third without breaking every caller.

**A payload is data, never a function.** It is structured-cloned into the
SharedWorker. Functions, class instances, and DOM nodes do not survive the trip.

**Nothing but the store.** No `fetch`, no `Date.now()`, no writing to
`localStorage` inside a mutation. A mutation runs inside a Yjs transaction and its
whole job is to change state; anything with a wait in it belongs in the worker's
`onReady`, which then calls the mutation with the result. `ctx.now()` is the one
piece of the outside world it is given, because the value it produces is stored
rather than recomputed.

**Return early rather than writing rubbish.** `if (!player?.name) return` is a
better guard than a validation layer, because the operator sees nothing happen and
tries again, and the show never held a nameless player.

**One button, one mutation.** If a click handler calls `mutate` twice, those are
two changes on air and the graphics will show the gap. Make it one mutation that
does both things.

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
