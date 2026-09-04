# Vainglory

A one-night studio: a spectator-style match bar, and a holding slide that runs
between matches.

Its own app, its own store. Nothing here is shared with `apps/fixture` — different
studio id, so a different database, a different worker and a different image
library. Running both at once is fine.

## Running it

```sh
pnpm vainglory            # dev server on http://localhost:5174
pnpm vainglory:build      # a static build in apps/vainglory/dist
pnpm vainglory:preview    # serve that build on http://localhost:4174
```

Use `pnpm vainglory` for the show. The build is there for serving from somewhere
else — any static host will do, since asset paths are relative. It does need an
`http://` origin: opening `index.html` off disk gives the page an opaque origin and
the SharedWorker the whole studio runs in will not start.

## Wiring OBS

The board is the page itself. Open <http://localhost:5174>, and take the browser
source URLs from **Settings → Browser sources** rather than typing them:

| Graphic       | URL                   |
| ------------- | --------------------- |
| Match bar     | `#/source/scoreboard` |
| Holding slide | `#/source/standby`    |

Both are authored for 1920×1080. Set the browser source to that size and let OBS
scale it.

## The board

**Match** — both team names, both scores, an accent colour each, and the
tournament mark. Names and colours stage until you save; the score steppers and the
buttons write immediately.

The mark comes from the image store: upload it in the **Slides** panel, then choose
it in _Tournament mark_. Nothing paints until you do — an unset mark is blank, not a
broken image.

**Standby** — the message on the card, the countdown, and a switch for each. The
countdown takes a clock time, counts down to it, shows the zero and then takes
itself off air.

**Slides** — the holding slide plays every image in the store filed under
`slides/`, in name order. To load them, drop a folder named `slides` onto the image
library, or type `slides` into the box above the drop zone before adding files. The
panel says how many it found; check that before air, because it counts only images
whose bytes are on _this_ machine.

## The knobs

`src/sources/Scoreboard.css` opens with four custom properties, and every
dimension on the match bar is one of them:

|               |                                                                         |
| ------------- | ----------------------------------------------------------------------- |
| `--vg-top`    | how far below the top edge the plates hang, clearing the game's own bar |
| `--vg-width`  | the span the two plates are pushed to the outer edges of                |
| `--vg-plate`  | how wide each plate is                                                  |
| `--vg-height` | how tall they are                                                       |

The dead space in the middle — the room the in-game HUD needs — is not set
anywhere. It is whatever `--vg-width` has left after two plates, so widen the span
or narrow the plates to open it.

`DWELL_MS` at the top of `src/sources/Standby.jsx` is how long each picture holds.
The cross-fade and the slow zoom are both paced off it.
