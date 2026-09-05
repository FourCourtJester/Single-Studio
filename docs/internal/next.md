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

## Publishing the plugin packages

All four are `private: true`, so `@single-studio/plugin-rocket-league` is a 404 on
npm and the only way into a studio is copying the folder — which
[plugins.md](../plugins.md) documents, and which was verified against a clean
template and the published tarballs.

Blocked on the reviews and on each plugin having a template. Note that a first
publish of a new name cannot use OIDC and needs the token path again; see
[releasing.md](releasing.md).

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
