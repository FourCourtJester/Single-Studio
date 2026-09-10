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

| graphic         | at                     | shows                                                       |
| --------------- | ---------------------- | ----------------------------------------------------------- |
| **Scoreboard**  | `#/source/scoreboard`  | Values, a count-up clock, and team colours through CSS vars |
| **Lower third** | `#/source/lower-third` | A toggle driving an entrance and an exit                    |
| **Standby**     | `#/source/standby`     | A slideshow off the image library, and a wall clock         |
| **Break timer** | `#/source/break-timer` | A countdown that every machine derives rather than ticks    |

The operator's board is at `#/`.

## Running it

```bash
npm install
npm run dev
```

## Why there is no plugin here

Plugins talk to something on the operator's own machine — OBS on a local websocket, a
game's stats port. A public deployment can reach none of those, so wiring one in
would put a permanently red light on a page whose job is to look like a working
show. [The plugins guide](https://fourcourtjester.github.io/Single-Studio/plugins)
covers them, and `apps/fixture` exercises them in the test suite.
