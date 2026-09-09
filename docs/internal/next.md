# Next

Left here rather than in a chat, so it survives.

## Rocket League

- **A test suite with the real game.** `dev/replay.mjs` proves the plugin and
  proves nothing about the wire format — every frame in it was typed from the same
  notes the parser was written from, so it cannot disagree with the parser. What is
  missing is a **capture script**: run it once with the game open, dump the frames
  to a file, and have `replay.mjs` play that back with the script as the fallback.
  Then the tests are the game's and not ours.

- **The command names.** `static commands` on the plugin is deliberately empty; the
  v2.72 names are documented where CI cannot reach. Five-line change once they are
  to hand. See [rocket-league.md](rocket-league.md).

## A plugin socket that hangs wedges the entire worker — fixed

Found on a real machine, and high severity: one unreachable plugin made a studio
render nothing at all, with no error anywhere a person will look. `started` waits for
every plugin's `start()`, every port message queues behind `started`, and
`SocketService.open()` settles only on the socket's `open` or `error` -- so an address
that *accepts and then does nothing* never settles, and the board never handles a
single message.

The existing mitigation makes plugin starts concurrent with each other, which
survives one slow plugin among several and not one hanging plugin on its own.

Fixed: the connection is no longer awaited at startup, only each plugin's stored
config. Written up in full, with the repro (VS Code forwarding the game's port into a
container where nothing was listening) and what is still open — no connect deadline
in `SocketService`, and a board that cannot say "not ready" — in
[host-hang.md](host-hang.md).

## `Scene`'s `vars` earns its place, or says when it does not

`vars` maps one custom property to one path and passes the value through verbatim.
That is the whole surface, and it means the prop is all-or-nothing: the moment a
scene needs *any* resolution logic, it drops out of `vars` entirely and does every
property in `style` instead.

The case that found this is the BSU Rocket League studio, which needs four:

| Property           | Wants                                                   |
| ------------------ | ------------------------------------------------------- |
| `--home-primary`   | the roster sheet's brand colour, else the colour the team is playing in |
| `--home-secondary` | that, darkened, for the far end of every gradient        |
| `--away-primary`   | as above                                                 |
| `--away-secondary` | as above                                                 |

None of the four can be written as `vars`, so all four are in `style` and the studio
re-implements the subscription `useVelcroVars` already does.

Two different gaps are tangled up in that, and only one is worth closing.

**Worth closing: a fallback chain.** `vars={{ '--home': ['home.color', 'rl.blue.color'] }}`
— the first path holding something wins. This is the commonest shape in any studio
driven by both a person and a feed: *operator override, else what the feed says.* It
needs no new concept, because "empty means no value" is already the store's rule
everywhere else. A studio that only needs this would keep using `vars`.

**Not worth closing: a transform.** `{ from: 'home.color', via: shade }` would make
the two derived properties declarative, and a function is legal here — `vars` is a
page-side prop, not a payload crossing into the worker, so nothing has to survive
structured clone. But it turns a declarative map into a small expression language,
and `style` already does it in one line.

The sharper observation is the one the docs should carry either way: **`vars` gives
the component no way to see the resolved value.** A scene that needs a value for
anything else — a derived property, a conditional class, a label — has to subscribe
to it anyway, and once it is subscribing, `vars` is pure overhead. So a fallback
chain would not on its own have saved the studio above: `--home-secondary` is
`shade(brand || game)`, which needs the resolved chain in JavaScript regardless.

So the change is two things, not one:

1. Accept an array of paths, first non-empty wins.
2. Say in [api.md](../api.md) that `vars` is the convenience form for properties
   nothing else reads, and that `style` with `useVelcroValue` is the right shape —
   not a failure to use `vars` — the moment a scene needs the value itself. Right
   now the API reference reads as though `vars` is *the* way to drive a graphic from
   operator input, and a studio author following it hits this and assumes they have
   done something wrong.

## Publishing the plugin packages — done

All four are publishable and go out with the framework, at the same version. They
ship their source rather than a build, which is also what
[templates/plugin](../../templates/plugin) does and the reason it needs no bundler.

Two things were found making them so, both by `verify:template` and neither by
anything else:

- **Every relative import needed its `.js`.** Node resolves a published source file;
  a bundler resolved every previous one. All four packed cleanly, installed cleanly,
  and threw on first import.
- **Core has to be a peer**, or npm may install a second copy and a studio ends up
  with two document registries — the plugin connects, emits, and nothing arrives.

The first publish of each name cannot use OIDC; see [releasing.md](releasing.md).

## Rocket League: `raw` on every payload

Every event carries `raw` alongside its shaped fields, which is what makes an
unknown event legible and what makes a known one noisy. Asked for as a switch on
the plugin panel rather than a constant -- on while you are finding out what the
game sends, off for a show.

Not urgent: it costs a reference, not a copy, and nothing downstream is confused by
it. Worth doing when the panel next gets attention.

## Getting a third party's data into a show

Asked as: can something on the local network -- Companion, a Stream Deck, any app
with an API -- post into a studio hosted on GitHub Pages? Written down because the
answer has one hard wall in it that is worth not rediscovering.

**No browser can be an HTTP listener.** There is no server socket in a browser; a
page initiates connections and never accepts them. Service workers intercept
requests our own pages make, not inbound traffic. So "an ingest endpoint on the
deployment" is not a Pages limitation to host around -- it is off the table on any
host, because the thing receiving is a tab.

Which is survivable, because everything worth listening to is already a server.
Companion runs an HTTP API and a WebSocket; the Stream Deck talks to Companion, not
to us. So we dial out, exactly as `plugin-obs` does.

**The dividing line is same machine vs. LAN, not Pages vs. self-hosted.**

- `ws://localhost:PORT` from an `https://` page works -- localhost is a potentially
  trustworthy origin and is exempt from mixed-content blocking. Confirmed against a
  real game: the Rocket League plugin reaches `ws://localhost:49124` from a
  Pages-hosted studio.
- `ws://192.168.x.x:PORT` from an `https://` page is blocked. A private IP is not a
  trustworthy origin, and Private Network Access adds a second layer on top.

The luck is that the target setup -- one PC running OBS, a Stream Deck on it,
Companion beside them -- is the localhost case. A Companion plugin would be the
shape of `plugin-obs` and cost an operator nothing beyond ticking it on.

Three routes, in order of what a user has to do:

1. **Nothing.** Plugin dials `ws://localhost`. Covers same-machine Companion, the
   Stream Deck through it, and anything else local. Proven pattern, no account.
2. **We deploy a relay; they paste a URL.** An HTTP ingest route on
   `packages/relay` applying a mutation into the room. Companion has a built-in
   HTTP Request action, so this needs no plugin at all, and it clears the LAN case
   -- Companion reaches the relay over https rather than the browser reaching
   Companion over http. "Paste a link into a dock" is already the collaboration
   setup, so it is not a new idea for an operator.
3. **Supabase**, if we ever want persistence and identity rather than a webhook.

**Worth checking before building any of it:** obs-websocket v5 has
`BroadcastCustomEvent`, and OBS is already on the machine, already holds the doc,
and `plugin-obs` is already connected to it. If Companion can be made to send a
custom event through its own OBS connection, that is a bus we already own -- no new
server, no new connection, and it crosses the LAN because Companion is the one
talking to OBS. Unverified twice over: that Companion exposes it, and that it
survives the round trip. `plugin-obs` does not handle `CustomEvent` today. Only
option that is both free and LAN-capable, so it is the first thing to test.
