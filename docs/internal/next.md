# Next

Left here rather than in a chat, so it survives.

## Raise these first

Asked for at the top of any "where are we at": the owner wants reminding of these
before anything else.

- **A `Panel` with header actions, that folds -- built, not released.** `actions`
  (anything, or a function given `{ open }`), `collapsible` and `defaultOpen` are in
  core on the branch. Still open from the same studio: `size="sm"` on the header
  buttons, `useCollapsed` and `Chevron` exported for folding cards, and zebra
  striping. See [the section below](#panel-header-actions-and-folding).
- **`color-scheme: dark` on the board, in core.** A time input's clock icon is
  drawn by Chrome, dark unless the page declares a dark theme, so it all but
  vanished on the board. A studio fixed it with `color-scheme: dark` on the board
  in its own `index.css`, which also gave dark versions of the time picker's
  popup, the menus behind `Select`, and the scrollbars. Every board is dark, so it
  belongs in `base.css`, scoped to `.ss-control` as the board's cursors are, so it
  never reaches a graphic.
- **`Sequence` in a real OBS.** 0.12.0 shipped it tested only in Chromium. The check
  that matters: a browser source with _Refresh browser when scene becomes active_
  ticked starts the sequence again from its first item every time the scene is
  taken.

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

**Still open.**

- `size="sm"` on `Confirm`, `ResetButton`, `SwapButton` and `Toggle`. The studio's
  header buttons still need `min-h-0! px-2.5! py-1! text-xs!`.
- `useCollapsed` and `Chevron`, exported, for the team cards the studio folds
  inside a panel. Core's chevron is `<Icon name="chevron" />`, unexported as a
  component of its own.
- **Zebra striping.** The studio shades every other panel,
  `.ss-control .ss-panel:nth-of-type(even) { background-color: rgb(30 41 59 / 0.7) }`,
  and its team cards and bracket rows with `odd:`/`even:`. The owner likes how it
  breaks up a long board; whether core does it by default, and for nested panels,
  is undecided.

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
that *accepts and then does nothing* never settles, and the board never handles a
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
scene needs *any* resolution logic, it drops out of `vars` entirely and does every
property in `style` instead.

The case that found this is the BSU Rocket League studio, which needs four:

| Property           | Wants                                                   |
| ------------------ | ------------------------------------------------------- |
| `--home-primary`   | the roster sheet's brand colour, else the colour the team is playing in |
| `--home-secondary` | that, darkened, for the far end of every gradient        |
| `--away-primary`   | as above                                                 |
| `--away-secondary` | as above                                                 |

None of the four can be written as `vars`, so all four are in `style` and the studio
re-implements the subscription `useVelcroVars` already does.

Two different gaps are tangled up in that, and only one is worth closing.

**Worth closing: a fallback chain.** `vars={{ '--home': ['home.color', 'rl.blue.color'] }}`
— the first path holding something wins. This is the commonest shape in any studio
driven by both a person and a feed: *operator override, else what the feed says.* It
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
   now the API reference reads as though `vars` is *the* way to drive a graphic from
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
