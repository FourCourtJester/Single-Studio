# @single-studio/plugin-rocket-league

Rocket League for [Single Studio](https://fourcourtjester.github.io/Single-Studio/):
score, clock, goals and the stat feed, over Psyonix's own Stats API. No BakkesMod and
no extra program — the game sends this itself.

```bash
npm i @single-studio/plugin-rocket-league
```

```js
import { rocketLeague, RocketLeagueHandler } from '@single-studio/plugin-rocket-league'

class MyShow extends RocketLeagueHandler {
  onScore({ blue, orange }) {
    this.mutate('set', { 'variables.home.score': blue, 'variables.away.score': orange })
  }

  onClock({ text }) {
    this.mutate('set', { 'variables.clock': text })
  }
}

createVelcroHost({ name: STUDIO_ID, mutations, plugins: [rocketLeague(MyShow)] })
```

The game's API is off by default and turning it on means editing one file on the
machine running it. The plugin's own **Plugins** panel carries the steps, which is
where somebody having the problem is actually looking.

## What it tells you

`onScore` and `onClock` for a scoreboard. `onGoal`, `onStatfeed` and `onCrossbar` for
the moments. `onMatchReady`, `onCountdown`, `onRoundStarted`, `onPaused`,
`onMatchEnded`, `onPodium` for the shape of a match. `onReplayStart`,
`onReplayEnding`, `onReplayEnd` for the goal replay. `onBallHit` and `onBoostPickup`,
which are frequent. `onState` for the whole tick.

`onReplayEnding` is the one worth knowing about: a graphic that waits for
`onReplayEnd` is already late, because the cut back to play has happened.

## Two things about the feed

**`onState` is throttled to ten a second and nothing else is.** The game sends the
tick up to 120 times a second whether anybody is looking or not; every other event
arrives as it happens, including ball touches and boost pickups. What to do about
those is a studio's decision, not this plugin's.

**`onClock` gives you `text` as well as `seconds`** — `mm:ss`, growing to `h:mm:ss`,
formatted by the same function `Timer` uses, so a clock from the game and a clock from
the board read identically on one scoreboard.

## Licence

MIT.
