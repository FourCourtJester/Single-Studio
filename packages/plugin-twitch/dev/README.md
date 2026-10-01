# Testing the Twitch plugin without Twitch

The rocket-league package has `replay.mjs`, a fake game. This is the same idea, with
one difference that matters: **the events are Twitch's, not ours.** The Twitch CLI
ships a mock EventSub server, so what reaches the plugin is Twitch's own shapes, and
a wrong field name in `src/events.js` shows up here instead of on a live show.

It also covers what real Twitch makes awkward: subs, gifts and cheers cost money, a
raid needs another channel, and nothing on Twitch reconnects you on demand.

## Once

Install the Twitch CLI. No account or configuration is needed for the mock server.

|         |                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------- |
| Windows | `winget install Twitch.TwitchCLI` or `scoop install twitch-cli`                                    |
| macOS   | `brew install twitchdev/twitch/twitch-cli`                                                         |
| Linux   | a release from [github.com/twitchdev/twitch-cli](https://github.com/twitchdev/twitch-cli/releases) |

## Each time

1. In the studio's worker, `twitch(MyShow, { mock: true })`.
2. From this repository, `pnpm --filter @single-studio/plugin-twitch mock`.
3. Start the studio. The plugin panel says "Mock mode" and the light goes green.
4. Press a key and Enter in the mock's terminal:

| Key | Sends                       |
| --- | --------------------------- |
| `f` | a follow                    |
| `s` | a sub                       |
| `r` | a resub                     |
| `g` | a gift                      |
| `c` | a cheer                     |
| `x` | a raid                      |
| `m` | a chat message              |
| `w` | Twitch's reconnect handover |
| `q` | quit                        |

Anything else you type is passed to `twitch event trigger` as it is, so
`channel.follow -v 2` works if a trigger needs its version spelled out.

## Not yet checked

This was written from the CLI's documentation in an environment that cannot reach
Twitch or GitHub's release downloads, so the first run is the check. In particular:

- **The address.** `mock: true` means `ws://127.0.0.1:8080/ws` for the socket and
  `http://127.0.0.1:8080/eventsub/subscriptions` for creating subscriptions. If the
  CLI says otherwise when it starts, pass `eventsub` and `helix` to `twitch()`
  instead of `mock`.
- **Whether a trigger reaches a client** before that client's subscription for it
  exists, and whether `channel.chat.message` can be triggered at all by the installed
  CLI version.
