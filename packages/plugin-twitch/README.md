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

createVelcroHost({ name: STUDIO_ID, mutations, plugins: [twitch(MyShow)] })
```

## What it tells you

`onChat`, `onFollow`, `onSubscribe`, `onResubscribe`, `onGift`, `onCheer`, `onRaid`.

## What the operator sets

A client id, the channel's numeric user id, their own user id, and an access token.
All four are facts about that person and their app, so they belong on the board rather
than in a build.

`Events` is a comma-separated list, blank for all of them. Subscribing to less than
everything is worth doing: each type is a separate subscription created at connect
time, and the ones you do not read still cost a round trip.

## Two things worth knowing

**A reconnect is a handover, not a drop.** Twitch hands over a URL rather than closing,
and the old socket keeps delivering until the new one has welcomed — so nothing is
missed and no graphic flickers. The plugin does that for you.

**Some subscriptions can be refused while others succeed**, usually because a scope is
missing. The plugin keeps going with what it got and says which were refused on the
board, rather than treating a partial success as a failed connection.

## Licence

MIT.
