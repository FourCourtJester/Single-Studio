# single-studio-plugin-example

A plugin for [Single Studio](https://fourcourtjester.github.io/Single-Studio/): it
reads something from the outside world and emits events a studio can build graphics
on.

Replace this paragraph with what yours reads, and the name everywhere with yours.

## Using it, from a studio

```bash
npm i single-studio-plugin-example
```

```js
// src/studio/velcro.worker.js
import { createVelcroHost } from '@single-studio/core/worker'
import { example, ExampleHandler } from 'single-studio-plugin-example'

class MyShow extends ExampleHandler {
  onScore({ home, away }) {
    this.mutate('set', {
      'variables.home.score': home.score,
      'variables.away.score': away.score,
    })
  }
}

createVelcroHost({ name: STUDIO_ID, mutations, plugins: [example(MyShow)] })
```

The operator sets the address and any credential on their own board, under
**Plugins** — those belong to the machine, not to the build.

### What it emits

| Event      | Method       | Payload                                            |
| ---------- | ------------ | -------------------------------------------------- |
| `score`    | `onScore`    | `{ home: { name, score }, away: { name, score } }` |
| `period`   | `onPeriod`   | `{ period, clock }`                                |
| `finished` | `onFinished` | `{ winner }`                                       |

Every payload also carries `raw`, which is the frame exactly as it arrived.

## Building your own from this

```bash
npm install
npm test
```

Then read [AGENTS.md](AGENTS.md) — it covers which of the two shapes to keep, what
belongs on the operator's panel, and the two things that bite at publish time.

The short version:

1. Pick `ExampleSocket` or `ExamplePoller` in `src/index.js` and delete the other.
2. Rewrite `src/events.js` to match what your far end actually sends.
3. Rename the package, and the `name` inside `definePlugin`.

## Licence

**The plugin you build from this is yours.** `LICENSE` ships with the copyright line
blank — fill in your own name and year, or replace the whole file with whatever
licence you want. Nothing here asks you to carry somebody else's.

The template itself came from [Single Studio](https://github.com/FourCourtJester/Single-Studio),
by Shaun "FourCourtJester" Delaney, which is MIT. You are free to use it, change it,
publish what you make from it and charge for it, with no attribution required and
nothing owed. What you write on top of it is your work and your responsibility,
and the original author has no claim on it and no part in it.
