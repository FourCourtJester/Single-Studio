# `fit` does nothing unless the `Variable` has a width

Found while converting a real show. Every use of `fit` in it was silently inert, and
nothing about the API suggests why.

## What happens

```jsx
<div className="name flex flex-col items-center justify-center">
  <Variable name="home.name" fit />
</div>
```

Reads as "shrink the name to fit that box". It does not. The name overflows exactly as
if `fit` were absent, with no error and no warning.

## Why

`Fit` measures against `element.parentElement`, and `Variable` renders `Fit` *inside*
its own element:

```jsx
<Transition as={as} className={cx('ss-variable', className)}>
  {loaded ? (fit ? <Fit>{text}</Fit> : text) : null}
</Transition>
```

So the parent it measures is the `Variable`'s own span, not the box the author was
thinking of:

```html
<span class="ss-variable">        <!-- Fit's parentElement -->
  <span class="ss-fit">…</span>
</span>
```

That span is sized by its content in every ordinary layout — a flex item with
`align-items: center` is not stretched, and an inline span never was. So
`element.scrollWidth <= available()` is true on the first check, `measure()` returns,
and no size is ever searched for.

Give the Variable a width and it works:

```jsx
<Variable className="w-full text-center" name="home.name" fit />
```

## Why this is worth changing rather than documenting

The failure is silent and the fix is invisible. Nothing in `api.md` mentions the
container; the prop reads as self-contained, and `fit` on a component that is *about*
sizing text is a reasonable thing to expect to work on its own.

It is also the wrong way round from how the rest of the source components behave.
`Image` has `fit="contain"` and needs nothing from its parent. `Ticker` measures its
own container. `Fit` alone requires the author to have arranged something it never
asks for.

Three options, roughly in order of how much they change:

1. **`Variable` stretches when `fit` is set.** A `w-full` equivalent applied by the
   component, since a Variable that has been told to fit is one whose width is meant
   to be the box's. Smallest change, and makes the common case work unaided.
2. **`Fit` walks up to the first parent with a constrained width**, rather than taking
   the immediate one. More forgiving, less predictable.
3. **Document it**, in `api.md` under `fit` and in the `Fit` source. Cheapest, and
   leaves a trap that costs an afternoon each time somebody meets it.

(1) with (3) seems right. There is no case I can see for a `Variable` that is asked to
fit and is also meant to be content-width — that combination is what silently does
nothing today.

## Also worth a line in the docs

`available()` subtracts the *parent's* padding, so padding on the Variable itself is
what gets subtracted once the fix above is applied — which is correct, and is not
obvious enough to leave unsaid.
