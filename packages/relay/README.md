# @single-studio/relay

One room per show, holding the document and rebroadcasting updates.

**The relay is not authoritative.** It holds a replica like everybody else. If it
dies mid-show every peer keeps rendering from its own document; when it comes back,
queued edits converge. That is the reason for a CRDT here rather than a server that
owns the truth: a relay outage costs collaboration, never the broadcast.

It speaks the standard y-websocket protocol, so a studio can point at this, at
`y-websocket`, at Hocuspocus or at y-sweet without changing a line.

## Run one

```bash
pnpm relay                              # ws://127.0.0.1:1234, memory only
pnpm relay -- --storage ./rooms         # survives a restart
pnpm relay -- --admin "$RELAY_ADMIN"    # enables the token API
```

## Deploy one

Cloudflare Durable Objects: one object per room, no machine to look after, and the
free tier covers a small production comfortably.

```bash
cd packages/relay
npx wrangler secret put RELAY_TOKEN     # optional, but do it
npx wrangler deploy
```

Then point a studio at `wss://<your-worker>.workers.dev`.

## What an operator does

Paste a link into an OBS custom browser dock:

```
https://your-studio.github.io/?relay=wss://relay.example.com&room=friday&key=…#/
```

That is their whole setup. They never see the word "token", and OBS remembers a
dock's URL so it is a once-ever step. `<RelayAdmin />` on the board mints those
links; `<RelayConnect />` is where whoever runs the show points their own machine
at the relay, once.

The address is read at runtime, so a studio deployed to GitHub Pages never needs
rebuilding to change relays.

## Connect a studio

Core imports no transport. The studio builds the provider and never hard-codes an
address; `useRelay` supplies one at runtime from the page's URL.

```js
import { createVelcroHost } from '@single-studio/core/worker'
import { WebsocketProvider } from 'y-websocket'

createVelcroHost({
  name: STUDIO_ID,
  mutations,
  sync: {
    url: 'wss://relay.example.com',
    room: 'friday-show',
    token,
    connect: ({ doc, url, room, token, report }) => {
      const provider = new WebsocketProvider(url, room, doc, { params: { token } })

      provider.on('status', ({ status }) => report(status))

      return provider
    },
  },
})
```

## Layout

| File                             | What                                                             |
| -------------------------------- | ---------------------------------------------------------------- |
| `src/room.js`                    | One room, n peers. Transport-agnostic, and where the logic lives |
| `src/protocol.js`                | The y-websocket wire protocol, server side                       |
| `src/node.js`, `bin/relay.mjs`   | A relay for Node: development, self-hosting, and the tests       |
| `src/worker.js`, `wrangler.toml` | The Cloudflare Durable Object                                    |

A room knows nothing about sockets. It is handed peers that can `send(bytes)` and
told when bytes arrive, so the same logic runs behind `ws`, behind a Durable Object,
and behind a pair of fakes — which is what makes convergence, late joiners and
presence cleanup testable with no socket in sight.

## Tokens

One token per operator, not one shared secret. Productions lose people, and that
must not mean rotating a secret everyone else has to be re-told.

A room nobody has issued a token for is **open** — the development case, and the
single-operator case. Issue one and the room is guarded.

```bash
curl -XPOST  localhost:1234/friday/tokens      -H "authorization: Bearer $RELAY_ADMIN" -d '{"name":"Sam"}'
curl         localhost:1234/friday/tokens      -H "authorization: Bearer $RELAY_ADMIN"
curl -XDELETE localhost:1234/friday/tokens/ID  -H "authorization: Bearer $RELAY_ADMIN"
```

Or use `<RelayAdmin />` on the board, which is the same API with a list and a
remove button. Revoking hangs up on the socket immediately rather than at the next
reconnect — the moment it has to work is the moment somebody is removed mid-show.

A secret is returned once, when it is minted, and never again. A relay that can
recite every operator's credential is a relay worth stealing.

Without `--admin` (or the `RELAY_ADMIN` secret on Cloudflare) the token API is off
entirely rather than open: an unguarded mint endpoint is a worse default than no
endpoint.

**Payload encryption is not implemented**, deliberately — it is mutually exclusive
with the relay holding a replica for late joiners. See
[collaboration.md](../../docs/collaboration.md) for the full argument.

## One Yjs, always

A studio's worker loads Yjs twice if anything bundles a copy of it — the framework
imports it and so does the sync provider. Two copies means a document created by
one and updated by the other: structs integrate, every `instanceof` check fails
against the wrong copy's classes, and remote values arrive as deleted placeholders.
Nothing throws, the bytes on the wire are perfect, and only the receiving side is
wrong.

`@single-studio/core` externalises it, the demo's Vite config dedupes it, and
`packages/core/test/bundle.test.js` fails if it is ever bundled again. If you build
a studio with a different bundler, make sure Yjs resolves to exactly one copy.

## Testing

```bash
pnpm --filter @single-studio/relay test   # 21 tests, no browser

VITE_RELAY_URL=ws://127.0.0.1:1234 pnpm demo:build
pnpm demo:preview
pnpm e2e:relay                            # two browsers against a real relay
```
