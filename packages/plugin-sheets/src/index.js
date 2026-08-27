import { definePlugin, Emitter, PluginHandler, Service } from '@single-studio/core/worker'

import { explain, parse, same, urlFor } from './sheet'

export { explain, keyOf, parse, same, urlFor } from './sheet'

/** Google allows 60 reads a minute per user. One a second is a rate limit waiting. */
const FLOOR_SECONDS = 5

/**
 * A shared spreadsheet as a data source.
 *
 * The one people actually ask for. A spreadsheet is the tool a production team
 * already has and already knows: the roster, the running order, the standings, the
 * lower-third copy for the night. Somebody who will never open a code editor will
 * happily keep a sheet up to date, and it is collaborative for free.
 *
 * Unlike the others this does not push. There is no socket and no notification, so
 * it asks on a timer -- and everything about the design follows from wanting to ask
 * as rarely as possible and to say nothing when the answer has not changed.
 *
 * **The ownership predicate matters most here.** Five operators each polling the
 * same sheet is five times the quota and five writers racing on the same paths, for
 * one sheet's worth of information. `Service` already answers that: exactly one
 * machine asks, and everybody else reads the replicated result.
 */
class Sheets extends Service {
  static serviceName = 'sheets'

  #timer = null

  #last = null

  events = new Emitter()

  constructor(context) {
    super({ mutate: context.mutate, owner: context.owner })

    this.config = context.config
    this.studio = context.studio
  }

  /** Seconds between reads, floored so a typo cannot burn a quota. */
  get every() {
    return Math.max(FLOOR_SECONDS, Number(this.config.every) || 30)
  }

  async open() {
    // The first read decides whether this is working, so a wrong id or a private
    // sheet is reported at once rather than on a timer nobody is watching.
    await this.#poll(true)

    this.#timer = setInterval(() => {
      this.#poll().catch(() => {})
    }, this.every * 1000)
  }

  async close() {
    clearInterval(this.#timer)
    this.#timer = null
  }

  /**
   * Ask once.
   *
   * @param {boolean} [first] Throw rather than back off, so `open()` can fail loudly.
   */
  async #poll(first = false) {
    if (!this.owns) return

    let response

    try {
      response = await fetch(urlFor({ id: this.config.id, range: this.config.range, key: this.config.key }))
    } catch (error) {
      // A network blip is not a misconfiguration. Backoff handles it; the operator
      // does not need telling twice a minute.
      if (first) throw error

      this.dropped(error)

      return
    }

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      const problem = new Error(explain(response.status, body))

      // A refusal is not something a retry fixes -- a private sheet stays private
      // however many times it is asked. Said once, and the plugin stops.
      this.emit('problem', { status: response.status, message: problem.message })

      if (first) throw problem

      this.status = 'error'
      clearInterval(this.#timer)
      this.#timer = null

      return
    }

    const next = parse(body, { header: this.config.header !== false })

    // The whole reason polling is cheap. An unchanged sheet says nothing, so the
    // studio's handler and every mutation it would make run only on a real edit.
    if (this.#last && same(this.#last, next)) return

    this.#last = next
    this.status = 'connected'

    this.emit('rows', { rows: next.rows, header: next.header, count: next.count })
  }

  emit(...args) {
    return this.events.emit(...args)
  }
}

/** The skeleton a studio fills in. */
export class SheetsHandler extends PluginHandler {
  static handles = { rows: 'onRows', problem: 'onProblem' }

  onRows() {}

  onProblem() {}
}

/** @param {typeof SheetsHandler} [Handler] */
export const sheets = (Handler = SheetsHandler) =>
  definePlugin({
    name: 'sheets',
    label: 'Google Sheet',
    config: [
      { key: 'id', label: 'Spreadsheet id', help: 'The long id in the sheet’s URL, between /d/ and /edit.' },
      { key: 'range', label: 'Range', default: 'A:Z', help: 'A1 notation, like Standings!A1:D20.' },
      {
        key: 'key',
        label: 'API key',
        type: 'secret',
        help: 'A Google API key with the Sheets API enabled. The sheet must be shared as “anyone with the link can view”.',
      },
      { key: 'every', label: 'Read every (seconds)', type: 'number', default: 30, help: 'Five is the floor. Google allows sixty reads a minute.' },
      { key: 'header', label: 'First row is column names', type: 'boolean', default: true },
    ],
    create: (context) => {
      const plugin = new Sheets(context)

      new Handler({ ...context, plugin }).attach(plugin.events)

      return plugin
    },
  })
