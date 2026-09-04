# Next

Left here rather than in a chat, so it survives.

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

## Publishing the plugin packages

All four are `private: true`, so `@single-studio/plugin-rocket-league` is a 404 on
npm and the only way into a studio is copying the folder — which
[plugins.md](../plugins.md) documents, and which was verified against a clean
template and the published tarballs.

Blocked on the reviews and on each plugin having a template. Note that a first
publish of a new name cannot use OIDC and needs the token path again; see
[releasing.md](releasing.md).

## Rocket League: `raw` on every payload

Every event carries `raw` alongside its shaped fields, which is what makes an
unknown event legible and what makes a known one noisy. Asked for as a switch on
the plugin panel rather than a constant -- on while you are finding out what the
game sends, off for a show.

Not urgent: it costs a reference, not a copy, and nothing downstream is confused by
it. Worth doing when the panel next gets attention.
