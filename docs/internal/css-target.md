# Nested CSS ships un-lowered, and every studio has this

**Latent rather than observed.** A studio's stylesheets are silently dead in every
browser the framework says it supports, except recent ones. No warning, no partial
styling — whole blocks simply do nothing.

Worth being precise about what has and has not been seen. This was found by reading
the built CSS, not by anything breaking: the studio that turned it up does all of its
testing in OBS, and OBS's embedded browser is new enough to support nesting natively,
so everything looked correct throughout. The exposure is real and nobody has met it.

## What happens

The template ships:

```js
// vite.config.js
build: { target: 'es2022' },
```

`build.target` is a **JavaScript** target. Vite's `build.cssTarget` inherits it, and
`es2022` says nothing about CSS features — so nothing tells the CSS pipeline which
browsers to compile for, and it ships what it was given. A stylesheet written with
nesting arrives at the browser still nested:

```css
#podium{ .scoreboard{ .score{font-size:12rem} .series{bottom:-2rem} } }
```

Native CSS nesting landed in **Chrome 112** (April 2023). `MINIMUM_VERSIONS` in
`packages/core/src/velcro/support.js` says:

| | |
| --- | --- |
| Chrome / Edge | 83 |
| Firefox | 114 |
| Safari | 16 |
| OBS (embedded browser) | 28 |

So on the browsers the framework promises, every nested rule does nothing at all.

## It is not only studio CSS

`packages/core/src/styles/base.css` nests too. So this is not "a studio wrote its
stylesheet in a modern dialect" — the framework's own stylesheet has the same
exposure, and a studio that never nests anything still inherits it.

## How it was found

While chasing an unrelated layout fault, by reading the compiled stylesheet and
noticing the nesting had survived it. The layout fault turned out to have another
cause; this was sitting underneath it.

Which is the useful part: it is invisible on any browser new enough to run the CSS as
written, and that is every browser anybody develops or tests on. It would first
appear on somebody else's older machine, as every stylesheet failing at once.

## Where it needs fixing

Not in one place. Confirmed present in:

| File | |
| --- | --- |
| `templates/studio/vite.config.js` | `build: { target: 'es2022' }`, no `cssTarget` — **every studio scaffolded from this inherits it** |
| `apps/fixture/vite.config.js` | the same |
| `packages/core/src/styles/base.css` | nests in 18 places, so a studio that never nests anything is still exposed |

That last row is the one that makes this the framework's problem rather than a
studio's: fixing it in a studio's own config fixes that studio, and the framework's
stylesheet is compiled by whatever config the studio happens to have.

## The fix

One line, and it belongs in the template rather than being left to a studio to
discover:

```js
build: {
  target: 'es2022',
  cssTarget: ['chrome83', 'firefox114', 'safari16'],
},
```

Verified: with it, `#podium .scoreboard .series{…}`; without it, the raw nesting. Zero
nested blocks remain in the built stylesheets afterwards, and the only ones left in
Tailwind's own output are `@layer` and `@supports`, which are correct.

## Worth doing properly

`MINIMUM_VERSIONS` already exists, in code, as the single statement of what is
supported. The template's `cssTarget` should be derived from it rather than written
out again — two places that must agree, and one of them is a config file nobody edits.

Something like exporting a ready-made target list beside it:

```js
export const CSS_TARGET = ['chrome83', 'firefox114', 'safari16']
```

so the template can say `cssTarget: CSS_TARGET` and the two cannot drift.

Failing that, the template's comment on `build` should at least say that `target` does
not cover CSS, because the natural reading is that it does.
