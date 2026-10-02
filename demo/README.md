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

| graphic           | at                       | shows                                                                 |
| ----------------- | ------------------------ | --------------------------------------------------------------------- |
| **Scoreboard**    | `#/source/scoreboard`    | Team names, logos from the image library, scores, round, team colours |
| **Lower thirds**  | `#/source/lower-thirds`  | Two straps on two toggles: one slides in, one fades                   |
| **Static**        | `#/source/static`        | A message, all three kinds of clock, a ticker, a slideshow behind     |
| **Clock**         | `#/source/clock`         | The time of day in the corner, 12- or 24-hour                         |
| **Twitch chat**   | `#/source/twitch-chat`   | The last six chat messages, emotes included                           |
| **Twitch alerts** | `#/source/twitch-alerts` | Follows, subs, gifts, cheers and raids, queued one at a time          |

The operator's board is at `#/`, with a panel for each, in the order a show uses
them.

Everything but Static is laid out to stack in one OBS scene: drag each source in at
full canvas size and nothing overlaps. The scoreboard is top centre with Twitch alerts
dropping in below it, the clock top right, the lower thirds bottom left and chat
bottom right. Static is full screen, for a scene of its own before the show and in
the breaks.

Two things come from the image library rather than from a field: the team logos,
picked on the Scoreboard panel, and Static's backdrop, which plays whatever is in the
library's `static` group. Drop a folder called `static` on the library to dress it.

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
