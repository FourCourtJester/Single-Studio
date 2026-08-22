# API review, before the template ships

A working document. The question it answers: can somebody who has never seen this
framework open the starter template, read `Control.jsx` and `Scoreboard.jsx`, and
work out how to add a thing of their own — without reading the source of the
component they are using?

Not yet. Most of it is close. What follows is ordered by what it costs that person,
not by how much work it is.

**Why now.** The packages are published but nothing depends on them: there is no
template repo, no demo repo, no studio in anyone's hands. Every rename below is free
today and expensive the moment those exist. This is the last cheap moment.

## The shape a studio author has to learn

Every piece of state has two components — one on the operator's board, one on air —
and they meet at a path. This is the table the documentation should open with,
because it is the whole mental model:

| What it is       | On the board (control)        | On air (source) | Lives under |
| ---------------- | ----------------------------- | --------------- | ----------- |
| Text             | `Field`                       | `Variable`      | `variables` |
| Number           | `Stepper`                     | `Variable`      | `variables` |
| One of a list    | `Select`, `Cycle`             | `Variable`      | `variables` |
| Colour           | `ColorPicker`                 | `Scene` `vars`  | `variables` |
| A picture        | `ImagePicker`, `ImageSelect`  | `Image`         | `variables` |
| Several pictures | `ImageSelect` `multiple`      | `ImageList`     | `variables` |
| On or off        | `ToggleButton`, `ImageToggle` | `Toggle`        | `toggles`   |
| Counting down    | `TimerButton`, `Countdown`    | `Timer`         | `timers`    |
| Counting up      | `Stopwatch`                   | `Timer`         | `timers`    |
| A table          | `Leaderboard`                 | _yours_         | `variables` |
| Scrolling text   | `Field`                       | `Ticker`        | `variables` |
| Wall clock       | —                             | `Clock`         | —           |

Two things fall out of writing it down. The clock row has three controls feeding one
source and no way to guess which is which. And the "one of a list" row has three
different prop names for the list.

## 1. Two ways to name the same value

The worst of these, and it is visible in the template we are about to hand people:

```jsx
<Field name="home.name" label="Home" />
<Stepper name="home.score" label="Home score" />
<SwapButton paths={['variables.home.name', 'variables.home.score', …]} />
<Select name="period" options={['1st', '2nd']} />
<ResetButton paths={['variables.home.score', 'variables.away.score']} />
```

A reader learns `name="home.score"` on line two and must write
`paths={['variables.home.score']}` on line four, in the same panel, in the file they
were given as their starting point. Nothing explains the switch, and the failure when
they get it wrong is silent — `unset` on a path that does not exist does nothing at
all.

`ResetButton`, `SwapButton` and `Scene`'s `vars` are the only three things in the
framework that take fully-qualified paths. Every other component takes `name` plus a
`namespace` that defaults sensibly.

**Change:** `names` + `namespace`, exactly like everything else. Keep `paths` as a
documented escape hatch for the rare cross-namespace case, so nothing that works
today stops working.

```jsx
<SwapButton names={['home.name', 'home.score', 'away.score', 'away.name']} />
<ResetButton names={['home.score', 'away.score']} label="scores" />
```

## 2. The clock components cannot be told apart by name

Three controls, one source:

| Component     | What it actually is                   | Guessable? |
| ------------- | ------------------------------------- | ---------- |
| `TimerButton` | counts down a **duration** — `5:00`   | no         |
| `Countdown`   | counts down to a **wall-clock time**  | no         |
| `Stopwatch`   | counts up                             | yes        |
| `Timer`       | the source; reads whichever is stored | yes        |

Nothing about "TimerButton" says duration, and nothing about "Countdown" says it
wants a time of day. A user wanting a five-minute break clock will reach for
`Countdown` and get the wrong one.

**Change:** name them for what the operator types into them.

- `TimerButton` → **`Countdown`** — the common case gets the obvious name
- `Countdown` → **`CountdownTo`** — reads as "counts down to 19:30"
- `Stopwatch`, `Timer` — unchanged, they are already right

## 3. Three words for "the list of allowed values"

`Select` takes `options`, `ImageSelect` takes `options`, `Cycle` takes `choices`.

**Change:** `Cycle` takes `options`. (`Leaderboard`'s `fields` stays — those are
columns, genuinely a different thing.)

## 4. Smaller things

- **`ColorPicker` defaults its label to `'Colour'`.** American in the component name,
  British in what it renders. Pick one; the component name cannot change without
  breaking every import, so the label should be `'Color'`.
- **`ImagePicker` renames `label` to `caption` internally** (`label: caption`) while
  every sibling calls it `label`. Invisible to users, confusing to anybody reading the
  source — which is a stated goal.
- **`Image` accepts both `name` and `value`.** Two ways to say where the picture comes
  from, and the second is undocumented. Keep both, but say what `value` is for.
- **`Variable` has a `fit` prop** — a layout concern on a data component. It works, but
  it is the one prop on that component that is not about the value.

## 5. Types

There are none. No `.d.ts`, no `types` field, no JSDoc annotations that a build could
turn into either. A studio author gets no autocomplete, no error when they misspell a
prop, and no way to discover that `Stepper` takes `step` without opening the source.

That is squarely against "ready to read and ready to use", and it is the single
biggest gap between this and a framework somebody would pick up voluntarily.

**Recommendation: JSDoc types, with `.d.ts` generated from them — not a TypeScript
rewrite.**

- Consumers get the whole benefit either way: full autocomplete and prop checking, in
  both JS and TS studios.
- The source stays JavaScript, which is what makes it readable straight through with
  no build step between what is published and what is written. A rewrite would put a
  compiler between the reader and the code, and the explicit ask here is that nothing
  is derived or obfuscated.
- It can go component by component, verified as it goes, instead of one change that
  touches every file in the package and has to land at once.

A rewrite would buy stricter checking of the framework's own internals. That is worth
something, and it is not what a studio author is affected by.

## Suggested order

1. **Addressing** (§1) — the one a new user hits in the first ten minutes
2. **Clock renames** (§2) — cheap now, breaking later
3. **`options`** (§3) and the small things (§4)
4. **Types** (§5) — the biggest piece, and the one that makes the documentation
   half-write itself, since every prop will have a description attached to it
5. **Then** the template documentation, against an API that has stopped moving

Doing 5 before 1–4 means writing every page twice.
