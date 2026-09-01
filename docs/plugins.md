# Plugins

A plugin brings data in from somewhere the framework knows nothing about — a game,
a spreadsheet, a broadcast tool — and **emits events**. What those events _mean_ to
your show is yours to decide, in a handler you write.

That split is the whole design. A plugin never writes to the document, so one
installed from npm has no authority over your show: the worst a badly-behaved one
can do is emit events you ignore. And it imposes no vocabulary — if your graphics
already read `home.score`, they go on reading `home.score`. A plugin that wrote
`rocketLeague.blue.goals` would hand a translation layer to everybody who disagreed
with it.

## Adding one to your studio

::: warning The first-party plugins are not on npm yet
`@single-studio/plugin-rocket-league` and its siblings live in the framework
repository but are not published, so `npm install` will not find them. Until they
are, copy the plugin's `src` folder into your studio — it depends on nothing but
`@single-studio/core`, which you already have.

```bash
# from your studio, with the framework cloned alongside it
cp -r ../Single-Studio/packages/plugin-rocket-league/src src/plugins/rocket-league
```

Then import from `./plugins/rocket-league` instead of the package name. Everything
else on this page is identical either way — the plugin depends on nothing the
template does not already have, so there is no install step and nothing to
configure.

This was checked rather than assumed: a clean template, the published `0.3.6`
tarballs, that `cp`, and the handler below build with no other change.
:::

A plugin is one import and one array entry, in your worker entry:

```js
// src/studio/velcro.worker.js
import { createVelcroHost } from '@single-studio/core/worker'
import { rocketLeague, RocketLeagueHandler } from './plugins/rocket-league'

import { STUDIO_ID } from './config'
import { mutations } from './mutations'

class MyShow extends RocketLeagueHandler {
  onScore({ blue, orange }) {
    this.mutate('set', { 'variables.home.score': blue, 'variables.away.score': orange })
  }
}

createVelcroHost({
  name: STUDIO_ID,
  mutations,
  plugins: [rocketLeague(MyShow)],
})
```

That is the whole of it. Nothing is discovered by scanning a folder and nothing is
registered by naming convention — a plugin is in your show because you imported it.

**It runs in the SharedWorker**, which is the one thing a studio has exactly one of.
So a feed is read once however many boards, previews and browser sources you have
open, and `this.mutate` is a direct call rather than a message. Your handler is in
the worker too; none of this code runs on the page.

**Settings are the operator's, not the build's.** The port a game listens on was
chosen by whoever runs the game, in a file on their own PC. Open **Settings →
Plugins** on the board to set it. Values are stored per studio on that machine, so
they travel with an export and are not replicated to anybody else.

## Handling events

A plugin ships a handler class with one method per event, all of them doing nothing.
You extend it and override the handful you care about.

```js
class MyShow extends RocketLeagueHandler {
  onGoal({ scorer, side, speed }) {
    this.mutate('set', {
      'variables.goal.by': scorer?.name ?? '',
      'variables.goal.speed': Math.round(speed),
      'variables.goal.side': side,
    })
  }

  onClock({ seconds, overtime }) {
    this.mutate('set', { 'variables.clock': seconds, 'variables.overtime': overtime })
  }
}
```

Only the methods you override do anything. There is no registration step, no list to
keep in sync, and a method you spell wrong is a method that simply never runs —
which is why the events are a declared map rather than "anything starting with
`on`". Nothing else in this framework is discovered by naming convention, and a typo
in a magic name is a handler that fails silently.

To find out what a plugin can tell you, read its `static handles` — it is the
complete list. Rocket League's is:

|                |                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| The scoreboard | `onScore` `onClock`                                                                                                                 |
| The moments    | `onGoal` `onStatfeed` `onCrossbar`                                                                                                  |
| The match      | `onMatchCreated` `onMatchReady` `onCountdown` `onRoundStarted` `onPaused` `onUnpaused` `onMatchEnded` `onMatchDestroyed` `onPodium` |
| Replays        | `onReplayStart` `onReplayEnding` `onReplayEnd` `onReplaySaved`                                                                      |
| Players        | `onPlayerJoined` `onPlayerLeft`                                                                                                     |
| Batched        | `onBallHits` `onBoostPickups`                                                                                                       |
| Everything     | `onState`                                                                                                                           |

`onReplayEnding` is the one worth knowing about: a graphic that waits for
`onReplayEnd` is already late, because the cut back to play has happened. That is
the cue to start animating in.

### Some events arrive as lists

`onBallHits` and `onBoostPickups` hand you an **array**, not one event:

```js
onBallHits(hits) {
  // [{ by, before, after, where, at }, …]
  this.mutate('push', { path: 'variables.touches', values: hits })
}
```

A dribble is a touch every few frames, and six cars crossing a pitch take boost pads
continuously. None of them is worth a graphic, but all of them are worth keeping for
the stats afterwards — so they are collected and handed over at most ten times a
second, each one dated on the way in.

**Write the batch in one call.** A loop calling `this.mutate` per item is one
transaction, one IndexedDB write and one broadcast _each_, which puts back exactly
what the batching removed. `push` takes `values` for this reason.

## What your handler is given

|                              |                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `this.mutate(name, payload)` | Run a mutation. Built-ins, or your own from `mutations`.                                                                       |
| `this.command(name, data)`   | Ask the far end to do something. Returns `false` rather than throwing when this machine is not the one that should be talking. |
| `this.config`                | What the operator set in **Settings → Plugins**.                                                                               |
| `this.studio`                | The studio id, if you need to name something.                                                                                  |
| `this.owner()`               | Whether this machine holds the OBS role.                                                                                       |
| `this.plugin`                | The running plugin itself — its `status`, and `send` for anything not on the command list.                                     |

`this.mutate` is the same registry your board uses, so everything in
[Your own data](/data) applies: the built-ins (`set`, `merge`, `increment`,
`toggle`, `only`, `swap`, `timer`, `stopwatch`, `push`, `pull`, `patch`, `append`,
`replace`, `clear`) plus whatever you passed as `mutations`. **One call is one
transaction**, however many paths it touches — so write related fields together and
the graphics see one change.

### Answering back

A command in reaction to an event needs nothing special. The event arrived on the
machine running the game, your handler runs on that machine, and the command goes
back down the same connection:

```js
class MyShow extends ObsHandler {
  onMatchEnded() {
    this.command('scene', { name: 'Podium' })
  }
}
```

A name that is not on the plugin's list **throws**, naming what it does accept — it
is a typo in your own code and the far end would swallow the frame without a word.
Not owning the role returns `false` quietly, because on a collaborating show that is
the normal state of every machine but one and you should not have to guard every
call.

Rocket League accepts no commands yet: the game gained them in v2.72, but the wire
names are not confirmed, and six plausible guesses would be six commands the game
silently ignores.

## Writing your own

Two base classes, depending on whether the thing tells you or has to be asked.

**Something that tells you** — a socket. Write `url` and `receive`; you get the
connection, JSON parsing, teardown, exponential backoff, a watchdog for a socket
that dies without saying so, and a status the board can show.

```js
import { definePlugin, PluginHandler, SocketService } from '@single-studio/core/worker'

class Scores extends SocketService {
  static serviceName = 'scores'

  get url() {
    return `wss://${this.config.host}/live`
  }

  async receive(message) {
    if (message.type === 'goal') this.emit('goal', { side: message.team, by: message.player })
  }
}

export class ScoresHandler extends PluginHandler {
  static handles = { goal: 'onGoal' }

  onGoal() {}
}

export const scores = (Handler = ScoresHandler) =>
  definePlugin({
    name: 'scores',
    label: 'Scores feed',
    summary: 'Goals and the clock, from the league feed.',
    config: [{ key: 'host', label: 'Host', default: 'scores.example.com' }],
    create: (context) => {
      const plugin = new Scores(context)

      new Handler({ ...context, plugin }).attach(plugin.events)

      return plugin
    },
  })
```

**Something that will not** — a poll. Write `read`; you get a floor on the interval
so a typed `1` cannot spend an hour's quota in a minute, an owner check so five
operators do not poll the same feed five times, and change detection so a read that
finds nothing costs one request and nothing else.

### Config and help are declared, not built

```js
config: [
  { key: 'port', label: 'Port', type: 'number', default: 49122, help: 'From the ini file.' },
  { key: 'apiKey', label: 'API key', type: 'secret' },
],
help: [
  { type: 'text', text: 'This is off by default; turning it on means editing one file.' },
  { type: 'steps', items: ['Close the game.', 'Open DefaultStatsAPI.ini.', 'Set Port to 49122.'] },
  { type: 'note', text: 'Settings are only read at startup.' },
  { type: 'link', href: 'https://example.com/docs', label: 'The documentation' },
],
```

Field types are `text`, `number`, `boolean` and `secret`. Help blocks are `text`,
`steps`, `code`, `note` and `link`. Both are validated when the plugin is defined,
so a wrong type throws where you wrote it rather than rendering nothing on air.

Help is structured blocks rather than markdown for two reasons that both bind: it
crosses `postMessage` from the worker, so it has to survive being cloned; and a
markdown string would need a parser and `dangerouslySetInnerHTML`, which is a way of
letting a dependency put arbitrary markup on an operator's board. As blocks, the
worst a plugin can do is write dull text.

Write the help. The person setting up the board at five to seven is not the person
who knows where the port comes from.
