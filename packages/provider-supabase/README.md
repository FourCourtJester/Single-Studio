# @single-studio/provider-supabase

Collaboration over a service the user owns, with a key nobody else holds.

## Why this one

A studio deploys as static files. Whatever carries edits between machines has to
work from a browser with no backend of any kind — and the vendor of the studio must
never hold a credential for it.

| Option                | Verdict                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Supabase Realtime** | Broadcast channels work from the browser with a project's anon key. Free tier is ample. **This.**                   |
| Pusher                | Client-to-client needs private channels, which need an auth endpoint — a backend, which is the thing being avoided. |
| Trystero              | Genuinely zero setup, but WebRTC cannot be created in a `SharedWorker` and the whole store lives in one.            |
| Your own relay        | [`@single-studio/relay`](../relay) — one deploy, for anyone who wants it.                                           |

The anon key is public by design; it is in the page of every Supabase app ever
shipped, and it is the _user's_ key in the _user's_ project. What guards a show is
the room name, exactly as it does with a relay.

## Setup, for whoever runs the show

1. Make a free project at supabase.com.
2. **Settings → API**: copy the project URL and the `anon` key.
3. Paste both into the board's **Relay** panel, with a room name.
4. Press **Invite** for each operator and send them the link.

An operator pastes that link into an OBS custom browser dock. That is their whole
setup — no key to type, no account to make, and OBS remembers the URL.

## Wiring

```js
import { createVelcroHost } from '@single-studio/core/worker'
import { connectSupabase } from '@single-studio/provider-supabase'

createVelcroHost({ name: STUDIO_ID, mutations, sync: { connect: connectSupabase } })
```

`url` is the project URL, `token` is the anon key, `room` is the show — the three
things an invite link already carries, so nothing else changes.

To accept either a Supabase project or a relay, dispatch on the address:

```js
const connect = (context) => (/^https?:/.test(context.url) ? connectSupabase(context) : connectWebsocket(context))
```

## What it gives up

There is no relay holding the document, so **an operator who opens their board while
every other machine is off sees an empty show** until somebody comes up. During a
broadcast that cannot happen — the machine running OBS is on by definition — and it
is the price of needing nothing deployed.

Everything else holds: concurrent edits merge, two operators tapping +1 make +2, and
a peer that drops keeps working from its own copy and converges when it returns.
