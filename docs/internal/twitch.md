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

`packages/plugin-twitch`, published with the framework. It went out before
it had run against real Twitch; the section below says what has been checked since.

| Module        | Does                                                                                                  | Tested               |
| ------------- | ----------------------------------------------------------------------------------------------------- | -------------------- |
| `protocol.js` | The message state machine: welcome, keepalive, notification, reconnect, revocation, replay protection | 12 tests             |
| `events.js`   | Twitch's payloads to shapes a studio would have written                                               | 18 tests             |
| `index.js`    | The socket, the subscriptions, the watchdog, sign-in, refresh, the channel lookup                     | 10 + 29 tests, fake socket and fake Twitch |
| `auth.js`     | Device Code Flow: code, poll, refresh, who-is, revoke                                                 | 14 tests, fake `fetch` |

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

## Checked against real Twitch

From a browser page on the published docs site, with a real Public-client Client ID
(Sep 2026): `id.twitch.tv/oauth2/device`, `id.twitch.tv/oauth2/token` and
`api.twitch.tv/helix/users` -- the last with `Authorization` and `Client-Id`
headers, so a preflighted request -- all answered a cross-origin call. **So this
needs no backend.** The Device Code Flow worked end to end from that page.

Then from the fixture (Oct 2026): signing in from the plugin panel, and a chat
message typed in the channel arriving on `#/source/twitch-chat`. So the subscription
POST for `channel.chat.message`, its condition fields and the delivery all work
against real Twitch. That run is also what found two bugs no fake had: a fitted name
at 0.0586px (`Fit` taking an inline span for its box), and every message arriving
three times (a plugin started again by each recheck while it was still connecting).

## Still unverified

1. **The condition fields for everything but chat.** `channel.follow` wants
   `moderator_user_id` and version `2`; `channel.raid` uses `to_broadcaster_user_id`;
   the sub, gift and cheer types take `broadcaster_user_id` alone. Written from the
   community libraries; chat, which shares the POST and the delivery, is confirmed.
   A refused one is now named on the panel, so the first follow or raid that fails to
   arrive will say so rather than look like a quiet night.
2. **What a moderator gets on somebody else's channel.** The panel's help says chat,
   follows and raids, and that subs, gifts and cheers need the channel's own sign-in.
   That is from Twitch's documentation, not from a run.
3. **Twitch's error wording** during the device flow (`authorization_pending`,
   `slow_down`). Matched loosely, on either `message` or `error`, for that reason.
4. **The Twitch CLI's mock server** that `dev/mock.mjs` drives: its port, its path,
   and whether a trigger reaches a client before that client subscribes. See
   `dev/README.md`.

## Signing in -- built

**Sign in with Twitch** on the plugin panel runs the Device Code Flow: a code on the
panel, typed at twitch.tv/activate on any device, and the panel following along
while the operator does it. This needed three things from core, all general rather
than Twitch-shaped: **actions** (buttons a plugin declares, and `offers` to say which
make sense now), a **notice** the panel re-reads every second while open, and
`context.save`, so a plugin can store a token it was handed. See plugins.md.

- **The Client ID is the author's**, passed to `twitch(Handler, { clientId })`.
  Operators never see the developer console. Without one, the panel asks for it.
- **Nobody types a user id.** It comes from `oauth2/validate`. A moderator types a
  channel *name*, looked up through Helix.
- **Refresh** happens before a connect when the token has under five minutes left,
  and once more if every subscription comes back 401. The new pair is stored before
  anything else can fail, because the refresh token is single use. A refused refresh
  signs the machine out rather than retrying.
