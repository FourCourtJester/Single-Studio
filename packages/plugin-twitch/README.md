# @single-studio/plugin-twitch

Twitch EventSub for
[Single Studio](https://fourcourtjester.github.io/Single-Studio/): chat, follows,
subs, gifts, cheers and raids, straight into a studio with no backend.

```bash
npm i @single-studio/plugin-twitch
```

```js
import { twitch, TwitchHandler } from '@single-studio/plugin-twitch'

class MyShow extends TwitchHandler {
  onFollow({ from }) {
    this.mutate('set', { 'variables.alert.name': from.name, 'variables.alert.kind': 'follow' })
  }
}

createVelcroHost({
  name: STUDIO_ID,
  mutations,
  plugins: [twitch(MyShow, { clientId: 'your-client-id' })],
})
```

## Once, as the studio's author: a Client ID

Register one application at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)
and pass its Client ID to `twitch()`. Nobody who runs your studio ever sees Twitch's
developer console.

- **Client Type: Public.** A studio is static files with nowhere to keep a secret,
  and a public client is what lets it sign in without one.
- **OAuth Redirect URL:** anything, such as `http://localhost:5173`. The form needs
  one; the sign-in never uses it.
- The Client ID is **not a secret**. It belongs in the build.
- Its name is what operators see on Twitch's approval screen.

## Every operator: Sign in with Twitch

On the board's plugin panel, press **Sign in with Twitch**. A code appears. Go to
twitch.tv/activate on any device, sign in as the channel, type the code, and approve.
The panel changes to "Signed in as …" and the plugin connects.

The machine stays signed in: tokens are refreshed in the background, and only Sign
out, a reset, or thirty days unused ask for the code again. Nobody types a user id or a
token.

A moderator running a board for somebody else's channel signs in as themselves and
types that channel's name under **Channel**.

## What it tells you

`onChat`, `onFollow`, `onSubscribe`, `onResub`, `onGift`, `onCheer`, `onRaid`, and
`onRevoked` for a subscription Twitch withdrew.

`Events` on the panel is a comma-separated list, blank for all of them. Twitch is only
asked for the permissions the chosen events need, so a studio that shows chat need not
ask for subscription access.

## Trying it without Twitch

```js
twitch(MyShow, { mock: true })
```

connects to the [Twitch CLI](https://github.com/twitchdev/twitch-cli)'s mock EventSub
server on this machine, with no sign-in. From this repository,
`pnpm --filter @single-studio/plugin-twitch mock` starts it and turns single keys into
test events. See [dev/README.md](dev/README.md).

## Two things worth knowing

**A reconnect is a handover, not a drop.** Twitch hands over a URL rather than closing,
and the old socket keeps delivering until the new one has welcomed, so nothing is
missed and no graphic flickers. The plugin does that for you.

**Some subscriptions can be refused while others succeed**, usually because a scope is
missing. The plugin keeps going with what it got rather than treating a partial
success as a failed connection.

## Licence

MIT.
