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
 * What a studio author fills in.
 *
 * A plugin ships a subclass of this with one method per event, all no-ops, and a
 * `handles` map naming which is which. An author extends *that* and overrides the
 * handful they care about, in a file of their own.
 *
 * The alternative was a callback in `velcro.worker.js` registering listeners
 * inline, and it does not survive contact with a real studio: twenty-two events on
 * one plugin turns the worker entry -- which should read as a manifest of what a
 * studio is made of -- into several hundred lines of wiring. A class also gives an
 * author somewhere to put the state that a handler needs between events, and
 * something to read to find out what a plugin can even tell them.
 *
 * Deliberately not "any method starting with `on`". Nothing else in this framework
 * is discovered by naming convention, and a typo in a magic name is a handler that
 * silently never runs.
 *
 * ```js
 * import { RocketLeagueHandler } from '@single-studio/plugin-rocket-league'
 *
 * export class MyShow extends RocketLeagueHandler {
 *   onGoalScored({ scorer }) {
 *     this.mutate('increment', `variables.${scorer.team}.score`)
 *   }
 * }
 * ```
 */
export class PluginHandler {
  /**
   * Event name to method name. Declared by the plugin's skeleton, not by the
   * studio author -- they only override methods.
   *
   * @type {Record<string, string>}
   */
  static handles = {}

  /**
   * @param {PluginContext & { plugin: PluginRuntime }} context
   */
  constructor(context) {
    this.mutate = context.mutate
    this.owner = context.owner
    this.studio = context.studio
    this.plugin = context.plugin
    this.config = context.config ?? {}
  }

  /**
   * Subscribe every declared method to its event.
   *
   * Walks the constructor's `handles` rather than the instance, so a subclass
   * inherits its parent's map without restating it.
   *
   * @param {import('../toolkits/emitter').Emitter} events
   * @returns {() => void} unsubscribe everything
   */
  attach(events) {
    const offs = []

    for (const [event, method] of Object.entries(this.constructor.handles ?? {})) {
      const fn = this[method]

      if (typeof fn !== 'function') {
        console.warn(`[plugin] "${event}" is mapped to ${method}(), which does not exist`)
        continue
      }

      offs.push(events.on(event, (...args) => fn.apply(this, args)))
    }

    return () => {
      for (const off of offs) off()
    }
  }
}

const FIELD_TYPES = new Set(['text', 'number', 'boolean', 'secret'])

/**
 * @typedef {object} PluginField
 * @property {string} key
 * @property {string} label What the operator reads.
 * @property {'text'|'number'|'boolean'|'secret'} [type] Defaults to text.
 * @property {string|number|boolean} [default]
 * @property {string} [help] A sentence under the field.
 * @property {string} [placeholder]
 */

/**
 * Declare a plugin.
 *
 * `create` is called once, by the host, with everything the plugin needs and
 * nothing it does not. It returns the running thing -- usually a {@link Service}
 * subclass, which already has reconnection, backoff and ownership.
 *
 * `config` is what the operator sets on the machine, not what the author sets in
 * the build. A port is the example that decides it: whoever runs the game chose
 * that number in an ini file on their own PC, and a studio author three time zones
 * away cannot know it. Baking it into the worker entry would mean a rebuild and a
 * redeploy to change a number that belongs to somebody else's desk.
 *
 * Values are stored per studio in the settings database, so they travel with an
 * export and are cleared by "reset this machine". They are **not** replicated: a
 * port is a fact about one computer.
 *
 * @param {object} definition
 * @param {string} definition.name Identifies it in status and in errors. Kebab-case.
 * @param {string} [definition.label] What the board calls it. Defaults to `name`.
 * @param {PluginField[]} [definition.config] Fields the operator can set.
 * @param {(context: PluginContext) => PluginRuntime} definition.create
 */
export function definePlugin({ name, label, config = [], create }) {
  if (!name || typeof name !== 'string') throw new TypeError('definePlugin needs a `name`')
  if (typeof create !== 'function') throw new TypeError(`plugin "${name}" needs a \`create\` function`)
  if (!Array.isArray(config)) throw new TypeError(`plugin "${name}": \`config\` must be an array of fields`)

  for (const field of config) {
    if (!field?.key) throw new TypeError(`plugin "${name}": every config field needs a \`key\``)
    if (field.type && !FIELD_TYPES.has(field.type)) {
      throw new TypeError(`plugin "${name}": field "${field.key}" has type "${field.type}"; expected one of ${[...FIELD_TYPES].join(', ')}`)
    }
  }

  return { [TAG]: true, name, label: label ?? name, config, create }
}

/**
 * The shipped values for a plugin's fields, before an operator changes anything.
 *
 * @param {PluginField[]} config
 * @returns {Record<string, unknown>}
 */
export const defaultConfig = (config = []) => Object.fromEntries(config.map((field) => [field.key, field.default ?? (field.type === 'boolean' ? false : '')]))

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
