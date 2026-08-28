# Twitch EventSub

Notes for the plugin. `dev.twitch.tv` is blocked by this container's egress proxy,
so what is written down here came from search results and community libraries
rather than from Psyonix's — Twitch's — own pages. **Anything marked unverified has
not been run against Twitch.**

## The short version

A studio can talk to Twitch with no backend, but not in the way it first looks.

- **EventSub over WebSocket** replaces the old IRC-for-chat and webhook-for-events
  split. One socket carries chat, follows, subs, gifts, cheers and raids.
- **Subscriptions are created over HTTPS, not over the socket.** After the welcome,
  the client POSTs to `https://api.twitch.tv/helix/eventsub/subscriptions` with the
  session id. So the plugin needs a Client ID and a user access token.
- **A Client ID is public** and belongs in a config field, not in a build.

## The auth constraint, which decides the design

Twitch calls an app with no client secret a **public client**, and:

> Public clients are only limited to the usage of device authorization grant flow to
> obtain OAuth tokens and cannot use any of the other flows like client credentials
> or implicit grant flow.

So **Device Code Flow is the only option** for something with nowhere to keep a
secret, which a static studio is. That turns out to suit an OBS dock better than the
alternative anyway: DCF needs no redirect, which is the part that is awkward inside
a dock. The operator gets a short code and types it at Twitch on any device.

Two properties of DCF refresh tokens to build around:

- **Single use.** Refreshing invalidates the token you refreshed with. Failing to
  persist the new one locks the studio out until somebody signs in again.
- **Thirty days of inactivity** and it expires, after which the flow starts over.

## What is built

`packages/plugin-twitch`, private and unpublished until it has run against real
Twitch.

| Module        | Does                                                                                                  | Tested               |
| ------------- | ----------------------------------------------------------------------------------------------------- | -------------------- |
| `protocol.js` | The message state machine: welcome, keepalive, notification, reconnect, revocation, replay protection | 12 tests             |
| `events.js`   | Twitch's payloads to shapes a studio would have written                                               | 18 tests             |
| `index.js`    | The socket, the subscriptions, the watchdog                                                           | 9 tests, fake socket |

None of it needs credentials to test, which is the point of the split.

### Four behaviours worth knowing

**The keepalive watchdog.** Twitch sends a keepalive whenever it has sent nothing
else, so silence past the budget means the connection is gone — without a close
frame. That is the failure that leaves a chat overlay looking healthy and frozen.
Reset by _any_ message, not only keepalives.

**The reconnect handover.** Twitch sends a URL rather than closing. The old socket
keeps delivering until the new one has welcomed, so nothing is missed in the gap;
closing early loses whatever arrives in it. Subscriptions are **not** recreated —
Twitch carries them across.

**Replay protection.** Message ids are remembered, bounded, and anything older than
ten minutes is dropped. A redelivered subscriber alert is indistinguishable from a
real one to everything downstream, and it is on air before anybody can stop it.

**Partial subscription failure is not total failure.** A studio missing `bits:read`
still gets chat. Only every subscription failing is an error.

## Unverified, and worth checking first

1. **CORS on `api.twitch.tv/helix` from a browser origin.** This is the one that
   decides whether "no backend" holds. If the subscription POST is blocked, that
   single call needs a proxy and nothing else about the plugin changes. Quickest
   check: a `fetch` from the console of any page, with a real Client ID and token.
2. **Device Code Flow end to end**, including whether the token endpoint at
   `id.twitch.tv` is reachable from a browser.
3. The exact condition fields per subscription type. `channel.chat.message` wants
   `broadcaster_user_id` _and_ `user_id`; `channel.follow` wants
   `moderator_user_id` and version `2`; `channel.raid` uses
   `to_broadcaster_user_id` instead of `broadcaster_user_id`. Written from the
   community libraries, not from Twitch's own reference.

## Not built

**Signing in.** The plugin currently takes a pasted access token, which works and is
poor: tokens expire, and pasting one is not something to ask of an operator mid-show.

Device Code Flow needs the board to show a code and a "waiting…" state while the
worker polls — which the config schema cannot express, because it is deliberately
JSON with no actions in it. That is the first real case for adding an **action** to
the schema: the plugin declares that it supports signing in, core draws the button
and renders whatever short-lived notice the plugin reports. Still data, still
crossing `postMessage` intact.

Worth doing deliberately rather than drifting into, and worth doing _after_ the CORS
question is answered — if a proxy turns out to be needed, the auth story changes
with it.
