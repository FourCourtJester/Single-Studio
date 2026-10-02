# Single Studio — Demo

The show you can click. **[Open it →](https://fourcourtjester.github.io/SS-Demo/#/)**

This directory is the source of truth. The repository at
[SS-Demo](https://github.com/FourCourtJester/SS-Demo) is a
mirror, replaced on every release by the `template` job in `.github/workflows/release.yml`,
the same way both starter templates are.

It lives here rather than standing on its own because a demo that stands on its own
drifts. The previous one was pinned to `@single-studio/core@^0.2.0` and sat at one
commit for four releases while being linked from the npm page for the framework.
Here it is built on every pull request, against the packages in this repository, so
an API rename breaks it at the moment the rename happens rather than months later in
somebody else's browser.

## What it shows

| graphic           | at                       | shows                                                        |
| ----------------- | ------------------------ | ------------------------------------------------------------ |
| **Scoreboard**    | `#/source/scoreboard`    | Values, a count-up clock, and team colours through CSS vars  |
| **Lower third**   | `#/source/lower-third`   | A toggle driving an entrance and an exit                     |
| **Standby**       | `#/source/standby`       | A slideshow off the image library, and a wall clock          |
| **Break timer**   | `#/source/break-timer`   | A countdown that every machine derives rather than ticks     |
| **Twitch chat**   | `#/source/twitch-chat`   | The last six chat messages, emotes included                  |
| **Twitch alerts** | `#/source/twitch-alerts` | Follows, subs, gifts, cheers and raids, queued one at a time |

The operator's board is at `#/`.

## Running it

```bash
npm install
npm run dev
```

## One plugin: Twitch

Most plugins talk to something on the operator's own machine — OBS on a local
websocket, a game's stats port — which a public deployment cannot reach, so they
would put a permanently red light on a page whose job is to look like a working show.
[The plugins guide](https://fourcourtjester.github.io/Single-Studio/plugins) covers
them, and `apps/fixture` exercises them in the test suite.

Twitch is on the internet, so it is here. **Settings → Plugins → Twitch → Sign in
with Twitch** puts your own channel's chat and alerts on the two Twitch graphics.
Until somebody does, the board's **Twitch** panel has buttons that send made-up
events through the same mutations real ones use, so the overlay can be tried without
a channel.

The graphics are laid out to stack in one OBS scene with the rest: the scoreboard
top centre with alerts dropping in below it, the lower third bottom left, chat bottom
right.
