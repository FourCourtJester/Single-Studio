# A plugin socket that hangs wedges the entire worker

**Severity: high. Fixed —** see [The fix, as applied](#the-fix-as-applied). Kept in
full because the diagnosis is the valuable part and the shape recurs.

One unreachable plugin made a studio render nothing at all, with no error anywhere a
person will look. Found against `@single-studio/core` 0.5.0 with
`plugin-rocket-league`, on a machine where the game's port accepted TCP but never
completed the WebSocket handshake.

## Symptom

Everything is dead, and nothing says so:

- every browser source renders blank — not a fallback, nothing
- **Settings → Plugins** sits on "Asking the worker…" forever
- the board never reaches ready
- no mutation from any page has any effect
- the worker console shows the plugin's own startup line and then silence

The natural reading is "my toggles are off" or "the feed isn't arriving". Both are
wrong, and both cost hours: the store never comes up at all, so every diagnostic
built on reading the store is also blank.

## Cause

Every port message is queued behind `started`:

```js
// packages/core/src/velcro/host.js:649
port.addEventListener('message', ({ data }) => {
  // Queue everything behind persistence so a mutation fired on page load
  // cannot be overwritten by IndexedDB replaying older state on top of it.
  started.then(() => handle(port, portId, data))
})
```

and `started` waits for every plugin to finish connecting:

| Where | What it does |
| --- | --- |
| `host.js:470` | `started` = persistence `.then(() => startPlugins().then(onReady))` |
| `host.js:368` | `startPlugins()` awaits `Promise.all(starting)` |
| `host.js:313` | `build()` awaits `runtime.start?.()` |
| `SocketService.js:96` | `open()` returns a promise settled **only** by the socket's `open` or `error` |

A socket into a black hole — a dropped SYN, or a TCP connection that never gets its
`101` — produces neither event. So `open()` never settles, `startPlugins()` never
resolves, `started` never resolves, and **no message from any page is ever handled**.

Note this is not the same as the connection being *slow*. It is unbounded.

## Why the existing mitigation does not cover it

`host.js:318-330` already names this hazard:

> A plugin's `start` is a handshake with somebody else's software: OBS does not
> resolve until it has identified, Twitch not until it has welcomed, and a socket to
> a machine that is switched off does not resolve or reject until the browser gives
> up on the connection.

The fix applied was to start plugins **concurrently with each other**, so the slowest
no longer gates the rest. But `startPlugins()` still awaits all of them, and
`started` awaits that — so a studio survives one slow plugin among several and is
wedged by one hanging plugin on its own. A single-plugin studio has no margin at all.

## Repro

Any address that **accepts a connection and then does nothing**. Refusing is *not*
enough -- that rejects `open()` and the existing error handling works correctly. It
has to hang.

1. Register any `SocketService` plugin pointed at such an address.
2. Open the board.
3. Settings → Plugins stays on "Asking the worker…"; every source is blank.

### How this was actually found, which is the point

Nobody contrived it. On a Windows machine running the game, with VS Code attached to
a devcontainer:

```
LocalAddress  OwningProcess
------------  -------------
127.0.0.1     15868          -> Code.exe
0.0.0.0       7532           -> RocketLeague.exe
```

**VS Code had port 49124 in its forwarded-ports list.** It binds the host's
loopback, accepts the connection, and tries to hand it to the container -- where
nothing is listening. So it accepts and hangs. Rocket League holds `0.0.0.0`, so
every *other* interface reached the game normally and only `localhost` was broken.

Nothing was misconfigured in the studio. The plugin's default address was correct,
the game was running and healthy, and the same studio had worked days earlier. An
editor quietly forwarding a port was enough to take the whole thing down, and the
only visible symptom was a blank overlay.

That is the argument for the fix below better than any constructed repro: the
hanging address is not an exotic case, and the studio gives no indication which of
its parts is unwell.

## Suggested fix

The reason for the await is real and stated at `host.js:468`:

> Awaited, because reading each one's stored config is a trip to IndexedDB. Without
> this `onReady` runs against a plugin map that is still filling.

That argument covers reading each plugin's **stored config**, not waiting for its
**connection**. Those are separable:

```js
// build(), roughly
const config = await configFor(definition)          // keep awaiting this
const runtime = definition.create({ ...pluginContext, config })

plugins.set(definition.name, runtime)
troubles.delete(definition.name)

// Let the connection settle on its own time.
Promise.resolve(runtime.start?.()).catch((error) => {
  troubles.set(definition.name, String(error?.message ?? error))
})

return runtime
```

`onReady` still gets a full plugin map, `pluginManifest()` still reports each
plugin's live `status`, and a connection that never completes now shows as
`reconnecting` on the panel instead of taking the studio with it.

A timeout on `open()` would also work and is worse: it puts a number on how long a
handshake may take, which is a guess about somebody else's software, and it leaves
the same failure in place for anything slower than the guess.

## Worth considering alongside

**A connect deadline in `SocketService`.** Independent of the above, `open()` having
no upper bound means `status` sits at `connecting` indefinitely rather than moving to
`error` — so even with the fix, the panel cannot distinguish "still trying" from
"never going to work". The reconnect backoff already exists; it just never gets a
chance to run.

**Say when the worker is not ready.** A board that has sent `plugins:list` and heard
nothing for a few seconds could say so, rather than showing the same "Asking the
worker…" it shows in the first 50ms. The failure is indistinguishable from the normal
case, which is most of why it is expensive to diagnose.

## The fix, as applied

`build()` takes `awaitStart`, false at startup and true on a configure:

```js
const connecting = Promise.resolve(runtime.start?.())

if (awaitStart) {
  await connecting

  return runtime
}

// Detached, so a start that never settles cannot hold `started` open. Its failure
// still has to land somewhere an operator can see, which is what this catch is for
// -- the caller is no longer around to do it.
connecting.catch((error) => {
  troubles.set(definition.name, String(error?.message ?? error))
  console.error(`[velcro] plugin "${definition.name}" threw while starting`, error)
})

return runtime
```

The split is the point. At startup nobody waits on any particular plugin and the
studio has to come up. On a configure an operator has just pressed Save and is owed
an answer about that one plugin -- and can be made to wait, because `configurePlugin`
runs *after* `started` and holds up nothing but its own reply. That also keeps the
"a config the plugin refuses says why, on the board" path working, which reads the
rejection from `build()`'s return.

`startPlugins()` still awaits, and what it awaits is now only each plugin's stored
config -- the trip to IndexedDB the original comment was actually justifying.

### What pins it

Three tests in `packages/core/test/plugins.test.js`, against a plugin whose `start`
returns `new Promise(() => {})`:

- the worker still answers a page: ready, a subscription, and a mutation that lands
- the rest of the studio still starts
- `pluginManifest()` still answers, so the panel can render and the address can be
  changed

A fourth was already there and was asserting the bug. `does not make one slow plugin
the reason the others are late` ended with `expect(everything).toBe(false)` -- that
`started` had *not* resolved while a plugin hung. It now asserts the opposite, and
checks the plugin is genuinely still pending so the studio really did come up around
it rather than the slow one having quietly finished.

Reverting the fix turns all four red.

## The connect deadline, as applied

`SocketService` gained `connectBudgetMs`, ten seconds, beside the `silenceBudgetMs`
it mirrors. The socket is given that long to come up; past it, `fail()` rejects
`open()`, `Service.start()` catches, and the retry runs.

That is deliberately the path a *refused* connection already took. Refusal fires
`error`, rejects `open()`, and backs off correctly -- that half was never broken. The
deadline puts the abandoned-connection case onto the same path rather than inventing
one, so the status is `error` and the backoff is the existing 500ms doubling to a 30s
cap.

Ten seconds because this is a handshake, not a download: the far end has already
accepted, and what remains is one exchange on an open connection. Anything that has
not managed it in ten seconds is not slow, and being wrong costs a retry -- which is
what would have happened anyway had the socket had the manners to refuse.

The deadline is stood down in `ready()`, in `fail()` and in `close()`. Missing any of
those is the way to get this wrong.

**It measures as far as `ready()`, not as far as the socket opening.** That is the
right end for the failure this exists for -- a connection accepted and then abandoned
never fires `open` either -- but it means any protocol handshake a service does
before declaring itself ready is inside the budget too. `plugin-twitch` therefore
overrides it to thirty seconds: `readyOnOpen` is false there, and between the socket
and `ready()` sit a welcome frame and one HTTP round trip per event type, seven by
default, in a row. Ten seconds is comfortable for a handshake and is not obviously
comfortable for that, and being wrong would not have looked like a slow connection --
it would have been a retry loop failing at the same point every time.

### What pins it

Four tests in `packages/core/test/service.test.js`, against a socket that accepts and
then fires nothing:

- it gives up at the deadline, reports the failure, and **tries again** -- the retry
  is the point, and before this there was no second attempt ever
- the message names the address, which is the part nobody can guess
- a healthy connection is not killed ten seconds in
- a service told to stop does not leave its deadline running

The last two are guards and were worthless as first written. Both asserted on
`status`, and `status` hides both faults: a misfiring deadline drops the connection
and the retry reconnects a beat later, landing back on `connected` with `problem`
cleared, so the end state is identical to never having misfired; and a stopped
service's deadline changes no status at all, because `dropped()` already refuses to
retry one. They now count connection attempts and pending timers respectively, and
each fails against the specific line it guards.

## Still open

- **Nothing sets a status while a handshake is in progress.** A connecting service
  reads `idle` -- the same thing it read before `start()` was called. The panel
  therefore cannot distinguish "not started" from "trying", which is a smaller
  version of the diagnosis problem this whole report is about.
- **The board cannot tell "still trying" from "never going to work."** Less urgent
  now that a stuck plugin no longer takes the board with it, and now that a stuck
  socket reaches `error` within ten seconds rather than never.
