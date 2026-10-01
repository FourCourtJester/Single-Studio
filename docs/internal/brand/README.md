# The logo

`logo.png` (800×800) is the master. Everything the site serves is made from it or
drawn to match it; there is no layered source.

It began as an image from Google Stitch with the name lettered underneath and the
whole thing on a dark square. Stitch will not export layers for a generated picture,
and asking AI Studio to edit it redrew the S rather than editing it. So it was
edited as pixels instead:

- **The lettering** was filled in from its surroundings (a Laplace fill), with grain
  added back to match the disc's (std ~2.6 against 2.3–3.3 measured around it).
- **The S** was moved down 52px to sit at the disc's centre (511, 512).
- **The circle** was drawn in by 20% (96px off a 481px radius) by moving the original
  ring inward, not by drawing a new one. The shading between the S and the ring is
  squeezed to fit; the grain is not, or it would streak. No seam shows at 4× brightness.
- **Outside the ring** is transparent, cut 3px past the ring's measured edge, which
  wobbles by about 4px around the circle.

## What is made from it

| File                               | What                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `docs/public/logo.webp`            | 512px, for the site's hero and the READMEs. 42 KB against 357 KB as PNG.                 |
| `docs/public/apple-touch-icon.png` | 180px. iOS puts it on black, which the disc already is.                                  |
| `docs/public/favicon.svg`          | **Drawn, not cut out.** The S reduced to a dark ribbon edged in the logo's red and cyan. |
| `docs/public/favicon-32.png`       | The SVG rendered at 32px, for browsers that do not take an SVG favicon.                  |

## Why the favicon is drawn

A transparent cut-out of the S was tried and is not good enough to ship: the glow and
the dark faces of the ribbon are the same colours as the background they were drawn
on, so every edge is a judgement, and at 16px the detail is noise anyway. A clean
cut-out needs the S on flat black, or a vector redraw.

Of two drawn versions, a bare neon tube washed out on a light tab strip; the dark
ribbon with a neon edge held up on both, and is the nearer of the two to the logo.
