# @single-studio/plugin-obs

OBS for [Single Studio](https://fourcourtjester.github.io/Single-Studio/): the live
scene, stream and record state, straight into a studio over obs-websocket.

```bash
npm i @single-studio/plugin-obs
```

```js
// src/studio/velcro.worker.js
import { obs, OBSHandler } from '@single-studio/plugin-obs'

class MyShow extends OBSHandler {
  onScene({ name }) {
    this.mutate('set', { 'variables.scene': name })
  }
}

createVelcroHost({ name: STUDIO_ID, mutations, plugins: [obs(MyShow)] })
```

The operator sets the host, port and password on their own board, under **Plugins** —
those belong to the machine, not to the build. OBS: **Tools → WebSocket Server
Settings**.

## What it tells you

| Method | When |
| --- | --- |
| `onConnected` | the connection is up and identified |
| `onScene` | the programme scene changed |
| `onPreview` | the preview scene changed (studio mode) |
| `onSourceVisibility` | a source was shown or hidden |
| `onStream` / `onRecord` | streaming or recording started or stopped |
| `onMute` | an audio input was muted or unmuted |
| `onTransitionStarted` / `onTransitionEnded` | a transition ran |
| `onExit` | OBS is shutting down |

## What you can ask it

```js
this.command('scene', { name: 'Podium' })
```

And from anywhere else in a studio — a mutation, another plugin's handler:

```js
ctx.ask('obs', 'scene', { name: 'Podium' })
```

`ask` when you want the answer back rather than fire-and-forget:

```js
const { sceneItemId } = await this.look('obs', 'GetSceneItemId', { sceneName: 'Match', sourceName: 'cam' })
```

That one exists because OBS assigns `sceneItemId` when a source is added to a scene
and changes it if the source is removed and put back — so it cannot be written down
anywhere and has to be looked up from the name somebody typed.

## Licence

MIT.
