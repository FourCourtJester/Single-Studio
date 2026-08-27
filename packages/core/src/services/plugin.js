import { Emitter } from '../toolkits/emitter'

// What a plugin is, and what it is deliberately not.
//
// A plugin brings data in from somewhere the framework knows nothing about -- a
// game, a spreadsheet, a scoring service -- and **emits events**. It does not write
// to the document. That is the whole design, and it decides three things at once:
//
//   1. A plugin installed from npm has no authority over the show. The worst a bad
//      one can do is emit events a studio ignores. Something with the store in its
//      hands could quietly rewrite a scoreboard on air, and no studio author is
//      going to audit a dependency for that.
//
//   2. It imposes no vocabulary. A studio whose graphics already read `home.score`
//      keeps reading `home.score`; the author decides what a goal means to their
//      show. A plugin that wrote `rocketLeague.blue.goals` would make every studio
//      that did not already agree with it write a translation layer.
//
//   3. It is testable with no store at all. Feed the parser a frame, assert on the
//      event.
//
// The studio author is the one who writes state, in their own mutations, in the
// handler they registered. Which is the same rule the rest of the framework
// follows: a studio is not special, it is just more mutations.

/**
 * @typedef {object} PluginContext
 * @property {(name: string, payload: unknown) => unknown} mutate Dispatch into the store.
 * @property {() => boolean} owner Whether this machine should be the one talking outward.
 * @property {string} studio The studio id, for naming anything the plugin persists.
 */

/**
 * @typedef {object} PluginRuntime
 * @property {string} name
 * @property {Emitter} events
 * @property {() => Promise<void> | void} [start]
 * @property {() => Promise<void> | void} [stop]
 * @property {() => Promise<void> | void} [recheck] Re-answer "do I own this?" -- called on every sync status change.
 * @property {string} [status]
 */

const TAG = Symbol.for('single-studio.plugin')

/**
 * Declare a plugin.
 *
 * `create` is called once, by the host, with everything the plugin needs and
 * nothing it does not. It returns the running thing -- usually a {@link Service}
 * subclass, which already has reconnection, backoff and ownership.
 *
 * @param {object} definition
 * @param {string} definition.name Identifies it in status and in errors. Kebab-case.
 * @param {(context: PluginContext) => PluginRuntime} definition.create
 * @returns {{ name: string, create: (context: PluginContext) => PluginRuntime }}
 */
export function definePlugin({ name, create }) {
  if (!name || typeof name !== 'string') throw new TypeError('definePlugin needs a `name`')
  if (typeof create !== 'function') throw new TypeError(`plugin "${name}" needs a \`create\` function`)

  return { [TAG]: true, name, create }
}

/** Whether this came from definePlugin, so the host can say so rather than crash. */
export const isPlugin = (value) => Boolean(value?.[TAG])

/**
 * Everything a plugin needs on top of a connection: an emitter, a status, and the
 * two hooks the host drives.
 *
 * Extends nothing, so a plugin that is not a network service -- one reading a file,
 * or a fake in a test -- can use it without inheriting reconnection logic it has no
 * use for. Plugins that do talk to a socket should extend `Service` instead and use
 * this only for the emitter.
 */
export class PluginBase {
  /** @type {Emitter} */
  events = new Emitter()

  constructor(name) {
    this.pluginName = name
    this.status = 'idle'
  }

  /** Convenience so a subclass writes `this.emit('goal', payload)`. */
  emit(event, ...args) {
    return this.events.emit(event, ...args)
  }
}

export { Emitter }
