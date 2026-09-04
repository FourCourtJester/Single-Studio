# My Studio

A [Single Studio](https://fourcourtjester.github.io/Single-Studio/) broadcast
graphics project: an operator's board that runs as a dock inside OBS, and one
browser source per graphic.

One repo per show. The repo's name is the show's address, the studio's `name` is its
label, and neither has to match anything on any server.

## Run it

```bash
npm install
npm run dev
```

Open the printed URL. The header menu lists every graphic's browser-source URL with
a copy button — that is what you paste into OBS.

**Any package manager works.** This is an ordinary Vite app with no workspace
protocol and no linking, so pnpm or yarn are fine; npm is used here only because it
comes with Node. If you switch, change the two `run` lines in
`.github/workflows/pages.yml` to match, and nothing else.

Commit the lockfile that first install produces. Nothing breaks without it — the
deploy workflow survives a repository that has never been installed — but it is what
makes a build today and a build in six months the same build.

**Pages has to be switched on once, and this workflow cannot do it for itself.**
Enabling Pages from inside an action needs a personal access token with `repo` scope,
which is a worse thing to keep around than one click. Either click it — **Settings →
Pages → Source → GitHub Actions** — or start the repository with `gh`, which is
already signed in as you:

```bash
gh repo create my-studio --template FourCourtJester/Single-Studio-Template --public --clone
gh api -X POST repos/<you>/my-studio/pages -f build_type=workflow
```

The second line is idempotent: a repository that already has Pages on answers `409`
and nothing changes. Skip it and the first deploy fails on a repository nobody has
touched yet, for a reason that reads like a broken template.

## Where things live

| Path                     | What it is                                                      |
| ------------------------ | --------------------------------------------------------------- |
| `src/control/`           | The operator's board — `Control.jsx` composes `panels/`         |
| `src/sources/`           | One component per graphic. Each becomes an OBS browser source   |
| `src/mutations/index.js` | How your show's data changes. Starts empty                      |
| `src/studio/`            | What the studio is called, its id, and the worker that holds it |
| `src/css/index.css`      | Tailwind, and your own CSS at the bottom                        |
| `public/`                | Images and fonts that ship with the studio                      |

Everything else — `index.html`, `src/main.jsx`, `vite.config.js` — already works and
you should not need to change it.

## Everything else

Adding a graphic, wiring it into OBS, clocks, images, transitions, collaborating and
deploying are all documented once, on the site:

**[Getting started →](https://fourcourtjester.github.io/Single-Studio/getting-started)**
&nbsp;·&nbsp;
[Components](https://fourcourtjester.github.io/Single-Studio/api)
&nbsp;·&nbsp;
[Your own data](https://fourcourtjester.github.io/Single-Studio/data)
&nbsp;·&nbsp;
[Plugins](https://fourcourtjester.github.io/Single-Studio/plugins)
