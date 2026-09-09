# A plugin socket that hangs wedges the entire worker

**Severity: high.** One unreachable plugin makes a studio render nothing at all, with
no error anywhere a person will look. Found against `@single-studio/core` 0.5.0 with
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
