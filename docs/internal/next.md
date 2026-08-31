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

## A `none` transition on `Variable`

Found while watching the replay: a clock written to `variables.period` fades out and
in every second.

Not a bug in `Transition` — it already guards the case its comment names, "a running
clock must not animate once a second", but that guard is for a value that is
_unchanged_ between renders. A clock counting down genuinely changes, so it animates,
correctly, and looks wrong.

`Transition` defaults to `transition = 'fade'` and `Variable` forwards the prop
through `...rest`, so the shape of the fix is: make `none` mean _no animation at
all_, rather than a variant class with no keyframes behind it. Check what
`transition="none"` does today before assuming it does nothing — it may currently
fall through to the fade.

Worth deciding at the same time whether a value that ticks wants a component of its
own rather than a prop, the way `Timer` already is.

## Publishing the plugin packages

All four are `private: true`, so `@single-studio/plugin-rocket-league` is a 404 on
npm and the only way into a studio is copying the folder — which
[plugins.md](../plugins.md) documents, and which was verified against a clean
template and the published tarballs.

Blocked on the reviews and on each plugin having a template. Note that a first
publish of a new name cannot use OIDC and needs the token path again; see
[releasing.md](releasing.md).
