# My Studio

A [Single Studio](https://github.com/FourCourtJester/Single-Studio) broadcast graphics project.

One repo per show. The repo's name is the show's address, the studio's `name` is
its label, and neither has to match anything on any server.

## Run it

```bash
npm install
npm run dev
```

**Any package manager works.** This is an ordinary Vite app with no workspace
protocol and no linking, so pnpm or yarn are fine — npm is used here only because it
comes with Node. If you switch, change the two `run` lines in
`.github/workflows/pages.yml` to match, and nothing else.

Commit the lockfile that first install produces. Nothing breaks without it — the
deploy workflow is written to survive a repository that has never been installed —
but it is what makes a build today and a build in six months the same build.

Open the control surface at the printed URL. The header menu lists every graphic's
browser-source URL with a copy button.

## Wire it into OBS

1. **Control surface** — Docks &rarr; Custom Browser Docks, point it at the app root (`.../#/`).
   Running the dock inside OBS is what puts it in the same browser process as your
   graphics, so they share one store with no network involved.
2. **Each graphic** — add a Browser source per URL listed in the menu under
   **Browser sources**. Set the resolution to your canvas (typically 1920x1080).
   Each copied URL carries the OBS layer name, so the source names itself.

   _Shutdown source when not visible_ is safe to enable. The graphic is rebuilt when
   its scene returns and paints nothing until it has real values, so you get the
   memory back without a flash of placeholder text on air.

## Add a graphic

Create `src/sources/MyGraphic.jsx` exporting a default component. That is the whole
step — it appears at `#/source/my-graphic` and in the **Browser sources** list, with
a copy button and the name OBS should give it.

The key comes from the path, and folders group:

```
src/sources/Scoreboard.jsx              →  #/source/scoreboard
src/sources/LowerThird.jsx              →  #/source/lower-third
src/sources/lower-thirds/Single.jsx     →  #/source/lower-thirds/single
src/sources/game/Scoreboard.jsx         →  #/source/game/scoreboard
```

The group carries through to the name OBS gives the source — `SS - My Studio -
Lower Thirds / Single` — so a scene list sorts the way the repo does.

> **`src/sources/` is only for graphics.** Everything in it becomes a browser
> source, so a shared plate, a hook or a helper belongs somewhere else —
> `src/components/` is the obvious home. A file left in `sources/` by mistake turns
> up in the operator's list and in OBS, which is a confusing way to find out.

To name them by hand instead, pass a plain object to `sources` in `src/studio.js`;
that file is the only place it matters.

## Deploy

Switch **Settings &rarr; Pages &rarr; Source** to **GitHub Actions**, then push to the
default branch. `.github/workflows/pages.yml` does the rest, and the board lands at
`https://<you>.github.io/<this-repo>/#/`.

Asset paths are relative, so it works at a repo subpath with no configuration — the
same build would serve from a custom domain or straight off a disk.

That published URL is the one you paste into OBS, and the one every invite link is
built from. Deploy before you set up collaboration.

## Bring other people in

Already wired. Open **Collaborate** in the header menu, paste a free Supabase
project's ID and publishable key, and press **Go**; send anybody the link it puts in
your address bar. Nothing connects until you do that, so a one-machine show pays
nothing for it — but a `connect` that is absent at build time is a collaboration
button that does not exist, which is why it is in `src/studio/velcro.worker.js` from the
start.

Shows are encrypted by default. The key is generated for you, rides the URL
fragment where no server ever sees it, and _is_ the room — so there is no room name
to invent and none for anybody to guess. Send the link like a password.

See [collaborating.md](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/collaborating.md)
for the Supabase steps and what to do when somebody has to be shut out.

## Where things live

### Yours

Making this studio your own means editing these and nothing else.

| Path                          | What it is                                                    |
| ----------------------------- | ------------------------------------------------------------- |
| `src/control/`                | The operator's board — `Control.jsx` composes `panels/`       |
| `src/sources/`                | One component per graphic. Each becomes an OBS browser source |
| `src/mutations/`              | How your show's data changes — `custom.js` starts empty       |
| `src/studio/studio.js`        | What the studio is called, and what it registers              |
| `src/studio/config.js`        | `STUDIO_ID`. Set it once, when you start                      |
| `src/studio/velcro.worker.js` | What the show connects to: plugins, and collaboration         |
| `src/css/index.css`           | Tailwind, and your own CSS at the bottom                      |

### Wiring

Working already, and exposed rather than hidden so you can read it — but you should
not need to change any of it.

| Path                     | What it is                                   |
| ------------------------ | -------------------------------------------- |
| `index.html`             | The page Vite serves                         |
| `src/main.jsx`           | Hands the studio to the framework            |
| `src/mutations/index.js` | Merges your mutation files into one registry |
| `vite.config.js`         | The build                                    |

Components come from one of two entry points, and which one a file uses says which
half of the show it belongs to:

```js
import { Field, Panel, Toggle } from '@single-studio/core/control' // src/control/
import { Scene, Toggle, Variable } from '@single-studio/core/source' // src/sources/
```

Hooks, mutations and toolkits are on the root `@single-studio/core`.

## Where to look things up

Kept in the framework's repository rather than copied in here, so they cannot go
stale against the version you are on.

- [Component reference](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/api.md) — every component, its props, and what reads it on air
- [Your own data](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/data.md) — writing your own state changes, and pulling data in from a feed
- [Getting started](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/getting-started.md) — the longer walkthrough, including transitions and the asset library
- [Collaborating](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/collaborating.md) — for whoever is running the show on the night
