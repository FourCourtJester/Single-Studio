# My Studio

A [Single Studio](https://github.com/FourCourtJester/Single-Studio) broadcast graphics project.

One repo per show. The repo's name is the show's address, the studio's `name` is
its label, and neither has to match anything on any server.

## Run it

```bash
pnpm install
pnpm dev
```

Commit the `pnpm-lock.yaml` that first install produces. Nothing breaks without it —
the deploy workflow is written to survive a repository that has never been installed
— but it is what makes a build today and a build in six months the same build.

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

1. Create `src/sources/MyGraphic.jsx` exporting a default component.
2. Register it in `src/studio.js` under `sources`.
3. It appears at `#/source/my-graphic` and in the browser-source list.

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
button that does not exist, which is why it is in `src/velcro.worker.js` from the
start.

Shows are encrypted by default. The key is generated for you, rides the URL
fragment where no server ever sees it, and _is_ the room — so there is no room name
to invent and none for anybody to guess. Send the link like a password.

See [collaborating.md](https://github.com/FourCourtJester/Single-Studio/blob/main/docs/collaborating.md)
for the Supabase steps and what to do when somebody has to be shut out.

## Where things live

| Path                      | What it is                                                     |
| ------------------------- | -------------------------------------------------------------- |
| `src/studio.js`           | The registry: name, id, control surface, one entry per graphic |
| `src/config.js`           | `STUDIO_ID` — names the IndexedDB store and every channel      |
| `src/velcro.worker.js`    | The SharedWorker that owns state. No React in here             |
| `src/mutations.js`        | Your own state changes, alongside the built-in ones            |
| `src/control/Control.jsx` | The operator's board                                           |
| `src/sources/`            | One component per graphic                                      |
