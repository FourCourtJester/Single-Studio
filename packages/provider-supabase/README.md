# @single-studio/provider-supabase

[![npm](https://img.shields.io/npm/v/@single-studio/provider-supabase.svg)](https://www.npmjs.com/package/@single-studio/provider-supabase)
[![licence](https://img.shields.io/npm/l/@single-studio/provider-supabase.svg)](https://github.com/FourCourtJester/Single-Studio/blob/main/LICENSE)

Multi-operator collaboration for [Single Studio](https://www.npmjs.com/package/@single-studio/core),
over a service **you** own, with a key nobody else holds.

Install it alongside the framework; it does nothing until somebody pastes an invite
link.

```bash
npm install @single-studio/provider-supabase
```

## Why this one

A studio deploys as static files. Whatever carries edits between machines has to
work from a browser with no backend of any kind — and the vendor of the studio must
never hold a credential for it.

| Option                | Verdict                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase Realtime** | Broadcast channels work from the browser with a project's anon key. Free tier is ample. **This.**                                |
| Pusher                | Client-to-client needs private channels, which need an auth endpoint — a backend, which is the thing being avoided.              |
| Trystero              | Genuinely zero setup, but WebRTC cannot be created in a `SharedWorker` and the whole store lives in one.                         |
| Your own relay        | [Run your own](https://github.com/FourCourtJester/Single-Studio/tree/main/packages/relay) — one deploy, for anyone who wants it. |

The publishable key (`anon` on older projects) is public by design; it is in the
page of every Supabase app ever shipped, and it is the _user's_ key in the _user's_
project. What guards a show is its **room key**: frames are sealed with it, and the
channel name is derived from it, so there is no room name for anyone to guess.

## Setup, for whoever runs the show

1. Make a free project at supabase.com.
2. **Project Settings**: copy the **Project ID**. **API Keys**: copy the
   **publishable** key (an older project shows `anon` under **Legacy**).
3. Paste both into the board's **Collaborate** dialog and press **Go**. There is no
   room to name — the key generated for you is the room.
4. Send the resulting link to each operator.

An operator pastes that link into an OBS custom browser dock. That is their whole
setup — no key to type, no account to make, and OBS remembers the URL.

## Wiring

```js
import { createVelcroHost } from '@single-studio/core/worker'
import { connectSupabase } from '@single-studio/provider-supabase'

createVelcroHost({ name: STUDIO_ID, mutations, sync: { connect: connectSupabase } })
```

`url` is the project URL, `token` is the publishable key, `room` is the channel —
derived from the room key by core before the provider ever sees it, so the provider
takes it exactly as it did when somebody typed one.

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
