# Next

Left here rather than in a chat, so it survives.

## Raise these first

Asked for at the top of any "where are we at": the owner wants reminding of these
before anything else.

- **Restart data, from the board.** The next thing to build. A worker cannot be
  killed from a page, but it can end itself with `self.close()`, and a page can
  reload itself with plain JS -- no OBS involved: measured on 2026-10-27, a dock's
  `window.obsstudio` answers nothing (see [obs.md](obs.md)). So a "Restart data" item
  in the board's menu, behind a confirm: the worker stops its plugins, leaves the
  room, waits for IndexedDB, posts "restarting" on the status channel and calls
  `self.close()` in the same task, so no page reconnects to it while it dies; every
  page then reloads, which starts a fresh worker that loads the show from
  IndexedDB. Warn about, or save, unsaved drafts first. An e2e check that a fresh
  worker comes up with the show intact and every open page on it. Known limits: a
  source unloaded while hidden does not reload, but starts fresh when shown; right
  after a deploy a reload can serve the old build from the HTTP cache for a few
  minutes. It also settles the two-worker window after a deploy, since the status
  channel reaches pages of either build. Reconnecting in place, without a page
  reload, is the polished version, for later.
- **Plugins an operator can switch off.** Asked for on 2026-10-29, queued rather than
  built. Today a plugin is in a studio because the worker's `plugins: [...]` names
  it, and it always starts: one whose target is not there keeps retrying, and its
  row in Settings → Plugins sits on "not connecting". The only way out is to delete
  it from `velcro.worker.js` and rebuild. The pieces for a switch already exist --
  per-machine plugin settings (where the port lives), a Save that restarts the
  plugin, and `Service` start/stop with an idle status the host already uses to
  stand a plugin down on a machine that is not running OBS. The shape: an on/off
  switch on each row, stored per machine like the port, so turning Twitch off on a
  laptop leaves it on at the streaming PC; on by default; off means stopped -- no
  connection, no retries, no Allow prompt, the row grey and reading "Off"; and an
  author default in the worker, e.g. `twitch(Chat, { enabled: false })`, for a
  studio that ships one off until it is wanted. E2e: off survives a reload, on
  again connects, and an off plugin emits nothing. Open: whether off also hides
  the plugin's panel on the board; start without that.
- **`Sequence` in a real OBS.** 0.12.0 shipped it tested only in Chromium. The check
  that matters: a browser source with _Refresh browser when scene becomes active_
  ticked starts the sequence again from its first item every time the scene is
  taken.

## Reports from client work, 2026-10-23

Filed by a studio running 0.13.0, every number measured on a live board. Each one is
checked against the code here; none is a 0.13.0 regression.

**All three are in 0.14.0**: the spacing properties and `.ss-board`, the
`col-auto` picker cap with `--ss-picker-max`, and the docs. Kept for the measurements.

### The board re-pads itself at 640px, and a studio cannot turn it off

Three things step at Tailwind's `sm`, as utilities in the markup:

| Element              | Where                                              | Below 640px    | From 640px     |
| -------------------- | -------------------------------------------------- | -------------- | -------------- |
| `.ss-panel`          | `Panel.jsx`, `p-3 sm:p-4`                          | 12px           | 16px           |
| the board's `<main>` | `pages/Control.jsx`, `gap-3 p-3 sm:gap-4 sm:p-4`   | 12px, gap 12px | 16px, gap 16px |
| `.ss-control-bar`    | `pages/Control.jsx`, `px-3 py-2.5 sm:px-4 sm:py-3` | 12px / 10px    | 16px / 12px    |

Why it matters: a studio can only undo it with unlayered CSS that beats
`@layer utilities`, which is overriding the framework's markup rather than setting a
value it offers -- unlike the Row, which exposes `--ss-row-gap`, `--ss-basis` and
`--ss-label-offset` on purpose. The `<main>` has no class at all, so the override has
to reach it as `.ss-control > main`. And it is keyed to the viewport, which in an OBS
dock is the dock: the chrome re-flows while an operator drags the dock edge past
640px, mid-show.

The ask: custom properties with today's values as defaults --
`--ss-panel-pad`, `--ss-board-pad`, `--ss-board-gap`, `--ss-bar-pad-x`,
`--ss-bar-pad-y` -- with the 640px step moved into `base.css` so it still happens by
default, and an `ss-board` class on the `<main>`. The studio carries unlayered
overrides pinned to the 640px-and-up values until then.

### `col-auto` on a control with operator-supplied content has no ceiling

`col-auto` is `flex: 0 0 auto` (`base.css`, `@utility col-auto`): size to content, never
shrink. Right for a Stepper, which is 160px for ever. Wrong for an `ImagePicker`,
which is a `<select>` and so as wide as the longest key in the library -- something
the operator sets at run time. Measured on a 640px board by renaming one asset:

| Longest key                           | Picker | The Field beside it |
| ------------------------------------- | ------ | ------------------- |
| `x`                                   | 136px  | 255px               |
| `broadcaster`                         | 202px  | 188px               |
| `northwind-esports-primary-logo-2026` | 365px  | 25px                |

A board checked at design time degrades months later because somebody named a logo
descriptively, and the neighbour that loses is usually the name field.

The ask is a cap inside the utility, where a breakpoint variant wraps it too:
`.ss-row > &.ss-image-picker { max-width: var(--ss-picker-max, 9.25rem) }`. A studio
cannot write that rule itself: `sm:col-auto` is a literal class at every width, so an
attribute selector also matches below the breakpoint, where the picker has a line to
itself and must fill it. The studio carries a width-band cap meanwhile, which also
holds back pickers that are not `col-auto` -- about 338px unused at 700px in one panel.

Open before building: whether the cap belongs to `ImagePicker` alone or to any control
sized by operator content, and whether a cap or a select that does not size to its
options is the better fix.

### Reading an `--ss-*` property, and a dev server that serves half a stylesheet

Not core's code, but core's users hit it, because core's layer runs on custom
properties. `max-width: var(--undefined)` is invalid at computed-value time and
resolves to `none` -- the same as a stylesheet that never loaded -- so a misspelt or
renamed property fails in silence. The studio met it twice in one day through Vite's
dev server: once a hot update applied one of two edits to the same file, and once an
auto-restart (a branch checkout touched `vite.config.js`'s mtime) brought the CSS
back with Tailwind's theme tokens but not one utility class. `npm run build` was right
both times; a restart fixed both.

The ask is docs only, where `getting-started.md` introduces the properties:

- read an `--ss-*` property with a fallback, `var(--ss-basis, 0%)`, so a typo or a
  rename degrades to a default rather than to nothing;
- when a rule has no effect, read the page's served `<style>`, not the file; a
  restart, not a reload, clears a half-applied hot update;
- a board with no utility classes but its theme intact is the dev server's utility
  scan, not the studio's CSS; if `npm run build` is right, stop reading your own
  files.

And a release that renames an `--ss-*` property is breaking for every studio that
overrides it, quietly, so it gets a line in the release notes.

## Panel: header actions, and folding

From the SS-Mercy-Riftbound-2v2 studio, which built all of it locally
(`src/control/collapse.jsx` and its own `Panel.jsx`) because core's `Panel` has
nothing beside its title. What it does, and what it learned, so core can take it
over rather than rediscover it.

**Behaviour.**

- The title is a button -- chevron and title -- that folds the panel body away.
- **Everything starts folded, on every load**, panels and the cards inside them
  alike. A fresh board is a short list of headers, and the operator opens what the
  next segment needs.
- The fold is component state and nothing else. Not the show, which would fold the
  panel on every operator's board; and not `localStorage`, so that a reload is
  always the same board.
- Header `actions` (Reset, Swap, Seed…) stay in the header and keep working while
  folded.
- A folded team card keeps a one-line summary -- "A1 · Comet Crew · 2–0 · 6 pts" --
  so a folded group still reads at a glance. Folding hides the controls, not the
  state of the show.

**How the studio built it.**

- `useCollapsed(initial = true)` returns `[collapsed, toggle]`: a plain `useState`,
  no keys and no storage. `false` starts one open.
- `<Chevron collapsed>` points down when open and turns −90° when folded.
- Markup is `<h2><button aria-expanded aria-controls={bodyId}>…</button></h2>`, with
  `id={bodyId}` from `useId` on the body. The button goes inside the heading: a
  heading inside a button is invalid HTML.
- The wrapper copies core's markup -- `.ss-panel`, `.ss-panel-body`, same classes
  and spacing -- so board CSS aimed at those still applies. The header's bottom
  margin goes while folded.

**What bit.**

- The studio's notes say `.ss-panel-body { display: flex }` beats the `hidden`
  attribute, so it sets Tailwind's `hidden` class as well. That does not reproduce
  in core: Tailwind's preflight, which every studio imports, has
  `[hidden] { display: none !important }`. A `[hidden]` rule written into `base.css`
  for it changed nothing -- with it removed, the folded body still measured 0px tall
  -- so core relies on the attribute alone.
- A grid of panels or cards needs `items-start`, or a folded one stretches to its
  neighbours' height.
- A folded summary reads saved values (`useVelcroValue`), not the staged draft, so
  it changes when the operator saves, not as they type.

**The shape asked for in core.**

```jsx
<Panel title="Slate" actions={<ResetButton … size="sm" />} collapsible defaultOpen={false}>
```

- `collapsible` turns folding on; `defaultOpen` starts one open. Folded is the
  default.
- `useCollapsed` and `Chevron` exported from `@single-studio/core/control`, so a
  studio folds its own cards the same way.
- It pairs with the other asks from the same studio:
  - `actions` on `Panel`, rendered right-aligned on the title line;
  - `size="sm"` on `Confirm`, `ResetButton`, `SwapButton` and `Toggle`, so a
    header button needs no overrides -- today it takes
    `min-h-0! px-2.5! py-1! text-xs!`. None of the four has a size yet;
  - `color-scheme: dark` on the board, above.

**What core has now** (on the branch, not released). `actions`, as anything or as
a function given `{ open }`; `collapsible`, off by default, so existing boards are
unchanged; `defaultOpen`. Settled on the way:

- No title, but actions: the header holds just the actions. No title and
  collapsible: a chevron of its own, named "Fold panel" or "Open panel". Neither,
  and no actions: no header at all.
- In a slim dock the actions take a line of their own under the title, still at the
  right, and the title keeps one line. Measured at 380px and 1280px.
- Folding hides the body without unmounting it, so a draft typed into a folded
  panel survives.

**Since then**, also in core: `size="sm"` on `Confirm`, `ResetButton`,
`SwapButton` and `Toggle`, with a 24px floor that holds when a studio squeezes the
padding; `useCollapsed` and `Chevron` exported from `@single-studio/core/control`;
every other panel a shade lighter, by default; and `color-scheme: dark` on
`.ss-control`. The stripes count sibling panels, so a panel wrapped in a `<div>` of
its own stays the darker shade -- written into the docs rather than worked around.

## Rocket League

- **A test suite with the real game.** `dev/replay.mjs` proves the plugin and
  proves nothing about the wire format — every frame in it was typed from the same
  notes the parser was written from, so it cannot disagree with the parser. What is
  missing is a **capture script**: run it once with the game open, dump the frames
  to a file, and have `replay.mjs` play that back with the script as the fallback.
  Then the tests are the game's and not ours.

- **The command names.** `static commands` on the plugin is deliberately empty; the
  v2.72 names are documented where CI cannot reach. Five-line change once they are
  to hand. See [rocket-league.md](rocket-league.md).

## A plugin socket that hangs wedges the entire worker — fixed

Found on a real machine, and high severity: one unreachable plugin made a studio
render nothing at all, with no error anywhere a person will look. `started` waits for
every plugin's `start()`, every port message queues behind `started`, and
`SocketService.open()` settles only on the socket's `open` or `error` -- so an address
that _accepts and then does nothing_ never settles, and the board never handles a
single message.

The existing mitigation makes plugin starts concurrent with each other, which
survives one slow plugin among several and not one hanging plugin on its own.

Fixed: the connection is no longer awaited at startup, only each plugin's stored
config. Written up in full, with the repro (VS Code forwarding the game's port into a
container where nothing was listening) and what is still open — no connect deadline
in `SocketService`, and a board that cannot say "not ready" — in
[host-hang.md](host-hang.md).

## `Scene`'s `vars` earns its place, or says when it does not

`vars` maps one custom property to one path and passes the value through verbatim.
That is the whole surface, and it means the prop is all-or-nothing: the moment a
scene needs _any_ resolution logic, it drops out of `vars` entirely and does every
property in `style` instead.

The case that found this is the BSU Rocket League studio, which needs four:

| Property           | Wants                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| `--home-primary`   | the roster sheet's brand colour, else the colour the team is playing in |
| `--home-secondary` | that, darkened, for the far end of every gradient                       |
| `--away-primary`   | as above                                                                |
| `--away-secondary` | as above                                                                |

None of the four can be written as `vars`, so all four are in `style` and the studio
re-implements the subscription `useVelcroVars` already does.

Two different gaps are tangled up in that, and only one is worth closing.

**Worth closing: a fallback chain.** `vars={{ '--home': ['home.color', 'rl.blue.color'] }}`
— the first path holding something wins. This is the commonest shape in any studio
driven by both a person and a feed: _operator override, else what the feed says._ It
needs no new concept, because "empty means no value" is already the store's rule
everywhere else. A studio that only needs this would keep using `vars`.

**Not worth closing: a transform.** `{ from: 'home.color', via: shade }` would make
the two derived properties declarative, and a function is legal here — `vars` is a
page-side prop, not a payload crossing into the worker, so nothing has to survive
structured clone. But it turns a declarative map into a small expression language,
and `style` already does it in one line.

The sharper observation is the one the docs should carry either way: **`vars` gives
the component no way to see the resolved value.** A scene that needs a value for
anything else — a derived property, a conditional class, a label — has to subscribe
to it anyway, and once it is subscribing, `vars` is pure overhead. So a fallback
chain would not on its own have saved the studio above: `--home-secondary` is
`shade(brand || game)`, which needs the resolved chain in JavaScript regardless.

So the change is two things, not one:

1. Accept an array of paths, first non-empty wins.
2. Say in [api.md](../api.md) that `vars` is the convenience form for properties
   nothing else reads, and that `style` with `useVelcroValue` is the right shape —
   not a failure to use `vars` — the moment a scene needs the value itself. Right
   now the API reference reads as though `vars` is _the_ way to drive a graphic from
   operator input, and a studio author following it hits this and assumes they have
   done something wrong.

## Publishing the plugin packages — done

All four are publishable and go out with the framework, at the same version. They
ship their source rather than a build, which is also what
[templates/plugin](../../templates/plugin) does and the reason it needs no bundler.

Two things were found making them so, both by `verify:template` and neither by
anything else:

- **Every relative import needed its `.js`.** Node resolves a published source file;
  a bundler resolved every previous one. All four packed cleanly, installed cleanly,
  and threw on first import.
- **Core has to be a peer**, or npm may install a second copy and a studio ends up
  with two document registries — the plugin connects, emits, and nothing arrives.

The first publish of each name cannot use OIDC; see [releasing.md](releasing.md).

## Rocket League: `raw` on every payload

Every event carries `raw` alongside its shaped fields, which is what makes an
unknown event legible and what makes a known one noisy. Asked for as a switch on
the plugin panel rather than a constant -- on while you are finding out what the
game sends, off for a show.

Not urgent: it costs a reference, not a copy, and nothing downstream is confused by
it. Worth doing when the panel next gets attention.

## Getting a third party's data into a show

Asked as: can something on the local network -- Companion, a Stream Deck, any app
with an API -- post into a studio hosted on GitHub Pages? Written down because the
answer has one hard wall in it that is worth not rediscovering.

**No browser can be an HTTP listener.** There is no server socket in a browser; a
page initiates connections and never accepts them. Service workers intercept
requests our own pages make, not inbound traffic. So "an ingest endpoint on the
deployment" is not a Pages limitation to host around -- it is off the table on any
host, because the thing receiving is a tab.

Which is survivable, because everything worth listening to is already a server.
Companion runs an HTTP API and a WebSocket; the Stream Deck talks to Companion, not
to us. So we dial out, exactly as `plugin-obs` does.

**The dividing line is same machine vs. LAN, not Pages vs. self-hosted.**

- `ws://localhost:PORT` from an `https://` page works -- localhost is a potentially
  trustworthy origin and is exempt from mixed-content blocking. Confirmed against a
  real game: the Rocket League plugin reaches `ws://localhost:49124` from a
  Pages-hosted studio.
- `ws://192.168.x.x:PORT` from an `https://` page is blocked. A private IP is not a
  trustworthy origin, and Private Network Access adds a second layer on top.

The luck is that the target setup -- one PC running OBS, a Stream Deck on it,
Companion beside them -- is the localhost case. A Companion plugin would be the
shape of `plugin-obs` and cost an operator nothing beyond ticking it on.

Three routes, in order of what a user has to do:

1. **Nothing.** Plugin dials `ws://localhost`. Covers same-machine Companion, the
   Stream Deck through it, and anything else local. Proven pattern, no account.
2. **We deploy a relay; they paste a URL.** An HTTP ingest route on
   `packages/relay` applying a mutation into the room. Companion has a built-in
   HTTP Request action, so this needs no plugin at all, and it clears the LAN case
   -- Companion reaches the relay over https rather than the browser reaching
   Companion over http. "Paste a link into a dock" is already the collaboration
   setup, so it is not a new idea for an operator.
3. **Supabase**, if we ever want persistence and identity rather than a webhook.

**Worth checking before building any of it:** obs-websocket v5 has
`BroadcastCustomEvent`, and OBS is already on the machine, already holds the doc,
and `plugin-obs` is already connected to it. If Companion can be made to send a
custom event through its own OBS connection, that is a bus we already own -- no new
server, no new connection, and it crosses the LAN because Companion is the one
talking to OBS. Unverified twice over: that Companion exposes it, and that it
survives the round trip. `plugin-obs` does not handle `CustomEvent` today. Only
option that is both free and LAN-capable, so it is the first thing to test.

## Future plugins: Dota 2, CS2, Warcraft III

Asked for as a list to come back to. Nothing here is built, and nothing here was checked
against the games: this container cannot reach them or Valve's pages. What follows is
what is known well enough to plan around, and the one question that decides the shape
of each.

**The thing that makes these different from Rocket League.** Rocket League runs a
WebSocket _server_ and the plugin dials it, which a browser can do. Valve's Game State
Integration is the other way round: the game is the _client_, and it POSTs JSON to a URL
you give it. A studio cannot receive that. See "No browser can be an HTTP listener"
above; this is that wall, arriving from a game rather than from Companion.

| Game             | How it talks                                                                                              | What the plugin needs                         |
| ---------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Dota 2**       | Valve GSI: HTTP POST of JSON to a URI named in a `gamestate_integration_*.cfg` in the game's `cfg` folder | a local receiver, plus a plugin that dials it |
| **CS2**          | The same GSI, carried over from CS:GO; the cfg lives under `game/csgo/cfg`                                | the same receiver as Dota 2                   |
| **Warcraft III** | Unknown. There is no Valve-style GSI. Needs research before anything else                                 | unknown                                       |

**One receiver for both Valve games.** GSI is one protocol with a different payload per
game, so a small local process that accepts the POST and serves it back out on
`ws://localhost:PORT` covers Dota 2 and CS2 alike. Each game is then an ordinary plugin
the shape of `plugin-rocket-league`: dial localhost, shape the payload, emit events.
Localhost is the case that already works from a Pages-hosted studio. Two candidates for
the receiver:

- **Route 2 above**: an HTTP ingest route on `packages/relay`, run locally. It already
  exists as a package, and it keeps "one thing to run" rather than two.
- **A dedicated `gsi-bridge`**: a few dozen lines of Node, published beside the plugins.
  Simpler to explain, but it is one more thing an operator installs.

Either way the operator's setup is two steps: drop a `.cfg` into the game's folder, and
run the receiver. Worth getting that down to one: the board could show the `.cfg` text
ready to copy, with the port already filled in.

**Worth knowing before designing the events:**

- **Spectating is the useful mode.** A player's own client reports that player. An
  observer or GOTV/SourceTV client reports both teams, which is what a broadcast wants.
  Design around the observer payload.
- **The cfg carries an `auth` token**, and the game sends it with every POST. The
  receiver should check it, because anything on the machine can POST to localhost.
- **GSI sends deltas as well as state** (`previously` and `added` blocks next to the
  full state). Emit from the full state and treat the deltas as hints, the way
  `scoreOf` reads the score from the tick instead of counting goals.
- **Warcraft III:** start by finding what the community already uses for Reforged
  observer overlays. Candidates to look at are a local API in the Reforged client,
  memory readers, and replay parsing. Replay parsing only helps after a game, not
  during one.

## An NGS plugin, for Heroes of the Storm

Asked for on 2026-10-29, as an idea to come back to. NGS is the Nexus Gaming Series,
the amateur Heroes of the Storm league; FCJ-Heroes-StormInterface, the studio this
would serve, takes its broadcast look from a 2018 NGS show. Nothing is built and
nothing here is checked: this container could not reach the league's site.

**Not a game feed.** Heroes has no live game-state API to dial, so this is not the
shape of `plugin-rocket-league`. What a league broadcast wants from NGS is the
league around the match -- the two teams, their logos and rosters, records and
standings, the schedule, results as they are reported -- and that comes from the
league's website, which makes it the shape of `plugin-sheets`: a poller that reads
something on a timer and writes it into the show.

**The questions that decide the shape, in order:**

- **Is there a public API, and what does it return?** The NGS site is a web app;
  whether it serves JSON a plugin can read -- teams, matches, divisions, standings --
  and without a login, is the first thing to find out. If there is none, the plugin
  is not worth starting.
- **Will a browser be let read it?** A studio is a page, often on GitHub Pages, and a
  poller in the worker is subject to CORS. If the API does not allow cross-origin
  reads, they go through a relay route rather than straight from the studio.
  `plugin-sheets` never needed one only because Google's API allows cross-origin
  reads with a key (see [sheets.md](sheets.md)).
- **What does a match look like, and how is it named?** The useful operator action
  is "this week's match is these two teams" and the rest -- names, logos, records,
  rosters -- following from it. That needs a stable match or team id to choose by,
  rather than names an operator types.

**What it would write, if the answers are yes:** each side's name, short name, logo
and record under the paths a Heroes studio already reads, the division standings as
a Leaderboard-shaped list, and the match's casters and time where the league has
them. Logos as URL entries in the image library, so every machine draws them.
