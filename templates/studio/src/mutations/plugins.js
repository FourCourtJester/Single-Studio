// Letting anything ask anything of a plugin.
//
// A plugin handler's `this.command()` reaches its *own* plugin, which is right and is
// also only half of what a show does. The commonest integration in broadcast is one
// source of truth driving a different piece of software: a game reports a goal and
// **OBS** cuts to the replay; a match ends and OBS takes the podium scene.
//
// There is no new mechanism for that, and that is the point. The mutation registry is
// already "everything this studio can do, in one object", and everything that might
// want to ask can already reach it:
//
//   a plugin handler   this.mutate('obs:scene', { name: 'Podium' })
//   the board          useVelcroMutate()('obs:scene', { name: 'Podium' })
//   another mutation   ctx.run('obs:scene', { name: 'Podium' })
//
// So a bridge is a file of mutations that call `ask`:
//
//   // src/mutations/obs.js
//   import { ask } from './plugins'
//
//   export const obs = {
//     'obs:scene'(ctx, { name } = {}) {
//       if (name) ask('obs', 'scene', { name })
//     },
//   }
//
// Nothing here runs until a plugin is registered, so this file is inert in a studio
// that has none. It is here so that adding one does not also mean inventing a way to
// reach it -- which is otherwise a module-scope singleton two handlers both import,
// and a back channel around the whole emit/handle design.
//
// **On a mutation doing something other than writing.** `docs/data.md` says a
// mutation touches the store and nothing else -- no fetch, no timers -- and the
// reason it gives is waits: anything that blocks belongs in `onReady`, which then
// calls a mutation with the result. A command is not a wait. It is one frame down a
// socket that is already open, it returns rather than resolving, and it answers
// `false` rather than throwing when this machine is not the one that should be
// talking. The letter of that rule is bent; the reason behind it is not.

/** Every plugin that started, by the name it was defined with. */
const running = new Map()

/**
 * Hand over the live plugins. Called once, from `onReady`.
 *
 * The one piece of this that cannot be declared: `createVelcroHost` takes mutations
 * and plugins together, so a mutation written at module scope has no plugin to close
 * over. `onReady` is handed the live map and is the first moment one exists.
 *
 * Deliberately not called `usePlugins`. That name belongs to a real React hook in
 * the framework -- the one the plugin panel reads -- and this is worker code that is
 * not a hook at all, so the two would be one name for two unrelated things and the
 * lint rule for hooks refuses it outright.
 *
 * @param {Map<string, object>} plugins
 */
export const register = (plugins) => {
  running.clear()

  for (const [name, plugin] of plugins ?? []) running.set(name, plugin)
}

/**
 * Ask a plugin to do something.
 *
 * Quiet when there is no such plugin, because that is the ordinary state of a show
 * not driving OBS tonight rather than a fault. Quiet, too, when this machine does not
 * hold the role -- the plugin answers that itself, and on a collaborating show it is
 * the normal state of every machine but one.
 *
 * A command name the plugin does not take **throws**, which is the plugin's own
 * behaviour and worth keeping: that is a typo in studio code, and the far end would
 * otherwise swallow the frame without a word.
 *
 * @param {string} plugin The name it was defined with -- `obs`, `sheets`.
 * @param {string} command
 * @param {object} [data]
 * @returns {boolean} Whether it went.
 */
export const ask = (plugin, command, data) => Boolean(running.get(plugin)?.command?.(command, data))

/**
 * Ask a plugin something and wait for the answer.
 *
 * Deliberately **not** a mutation. A mutation must not wait -- that is the part of
 * "nothing but the store" that genuinely binds -- so anything needing a reply belongs
 * in a handler, which is ordinary async code.
 *
 * What it is for: names are the only handle a person has on things inside somebody
 * else's software, and ids are often the only handle its API takes. OBS assigns a
 * source's `sceneItemId` when it is added to a scene and changes it if the source is
 * removed and put back, so it cannot be written down anywhere -- it has to be looked
 * up, every time, from the name somebody typed.
 *
 * Returns `undefined` when there is no such plugin, and whatever the plugin answers
 * otherwise. Neither throws.
 *
 * @param {string} plugin
 * @param {string} request The far end's own request name, e.g. `GetSceneItemId`.
 * @param {object} [data]
 * @returns {Promise<object|undefined>}
 */
export const look = (plugin, request, data) => running.get(plugin)?.ask?.(request, data)

/** What is running, for anything that wants to check before asking. */
export const has = (plugin) => running.has(plugin)
