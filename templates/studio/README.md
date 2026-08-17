# My Studio

A [Single Studio](https://github.com/FourCourtJester/Single-Studio) broadcast graphics project.

## Run it

```bash
pnpm install
pnpm dev
```

Open the control surface at the printed URL. It lists every graphic's browser-source
URL with a copy button.

## Wire it into OBS

1. **Control surface** — Docks &rarr; Custom Browser Docks, point it at the app root (`.../#/`).
   Running the dock inside OBS is what puts it in the same browser process as your
   graphics, so they share one store with no network involved.
2. **Each graphic** — add a Browser source per URL listed on the control page.
   Set the resolution to your canvas (typically 1920x1080) and leave
   _Shutdown source when not visible_ unchecked so state stays warm.

## Add a graphic

1. Create `src/sources/MyGraphic.jsx` exporting a default component.
2. Register it in `src/studio.js` under `sources`.
3. It appears at `#/source/myGraphic` and on the control page's list.

## Deploy

```bash
pnpm build && pnpm deploy
```

Publishes `dist/` to the `gh-pages` branch. Asset paths are relative, so it works
at a repo subpath without extra configuration.
