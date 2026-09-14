import { definePlugin, PluginHandler, PollingService } from '@single-studio/core/worker'

import { explain, idFrom, parse, urlFor } from './sheet.js'

export { explain, keyOf, parse, same, urlFor } from './sheet.js'

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
class GoogleSheets extends PollingService {
  static serviceName = 'google-sheets'

  /** Google allows sixty reads a minute per user. One a second is a limit waiting. */
  get floorSeconds() {
    return 5
  }

  async read(signal) {
    // Handed to `fetch` so the deadline actually stops the request. The base class
    // enforces it either way, but without this the abandoned request keeps running
    // and the next tick's poll queues up behind somebody else's stalled socket.
    const response = await fetch(urlFor({ id: this.config.id, range: this.config.range, key: this.config.key }), { signal })
    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      const problem = new Error(explain(response.status, body))

      // Marked so `fatal` can tell a refusal from a dropped network without
      // matching on the message text.
      problem.refused = true
      problem.status = response.status

      throw problem
    }

    return parse(body, { header: this.config.header !== false })
  }

  /**
   * A refusal is not something a retry fixes: a private sheet stays private however
   * many times it is asked, and retrying only spends quota to be refused again. A
   * dropped network is the opposite.
   */
  fatal(error) {
    return Boolean(error?.refused)
  }

  /** The status is what a handler wants; the sentence is what a board shows. */
  problemOf(error) {
    return { status: error?.status ?? null, message: error?.message ?? String(error) }
  }

  /** `rows` rather than the base class's `changed`, because that is what it is. */
  publish(next) {
    this.emit('rows', { rows: next.rows, header: next.header, count: next.count })
  }
}

/** The skeleton a studio fills in. */
export class GoogleSheetsHandler extends PluginHandler {
  static handles = { rows: 'onRows', problem: 'onProblem' }

  onRows() {}

  onProblem() {}
}

/**
 * @param {typeof GoogleSheetsHandler} [Handler]
 * @param {{ id?: string, range?: string, header?: boolean }} [sheet]
 *   The sheet this studio was written against: which spreadsheet, and which cells.
 *
 *   **The range is the studio's and cannot be overridden.** It is not a preference.
 *   The graphics reading it have code that expects columns in an order, and a range
 *   that does not match is not a different view of the same data -- it is a graphic
 *   quietly showing the wrong column, which is the worst way for this to fail.
 *
 *   **The id is a default the operator may replace**, which is a different question
 *   from the range and was once wrongly treated as the same one. The range is the
 *   *shape* of a sheet; the id is *which copy of that shape*. A team running two
 *   setups off duplicates of one layout needs to point each at its own, and the
 *   graphics cannot tell the difference -- that is what makes it safe where a range
 *   is not.
 *
 *   Leave the field on the panel blank and the studio's id is used, so a studio that
 *   ships a new sheet in a later release reaches everybody who never overrode it.
 */
export const sheets = (Handler = GoogleSheetsHandler, sheet = {}) =>
  definePlugin({
    name: 'sheets',
    label: 'Google Sheet',
    summary: 'Reads a spreadsheet, so anybody on the team can update the show from a browser.',
    help: [
      { type: 'text', text: 'Two things are needed: the sheet has to be readable by anyone with its link, and you need a Google API key.' },
      {
        type: 'steps',
        items: [
          'Open the sheet, press Share, and set General access to "Anyone with the link" as a Viewer.',
          'Go to console.cloud.google.com, make a project if you have none, and enable the Google Sheets API for it.',
          'Under APIs & Services → Credentials, create an API key and paste it above.',
        ],
      },
      {
        type: 'note',
        text: 'Which cells this reads comes from the studio and cannot be changed here — the graphics expect those columns in that order. Which sheet it reads can: leave Spreadsheet blank for the one the studio ships, or paste another that uses the same layout.',
      },
      { type: 'link', href: 'https://console.cloud.google.com/apis/credentials', label: 'Google Cloud credentials' },
      {
        type: 'note',
        text: 'The key only ever reads, and only what the sheet’s own sharing already allows. It is worth restricting it to the Sheets API in the Cloud console.',
      },
      { type: 'text', text: 'The first row is used as column names by default, so a heading of "Team Name" becomes teamName in your graphics.' },
    ],
    config: [
      {
        key: 'id',
        label: 'Spreadsheet',
        type: 'text',
        // The studio's own id, greyed out rather than filled in. Filling it in would
        // store it, and a stored copy is a copy that stops following the studio --
        // a later release pointing at a new sheet would reach nobody who had ever
        // opened this panel.
        placeholder: sheet.id ?? 'The one this studio ships with',
        help: 'Paste the sheet’s address from your browser, or just its id. Leave it blank to use the sheet this studio ships with.',
      },
      {
        key: 'key',
        label: 'API key',
        type: 'secret',
        help: 'A Google API key with the Sheets API enabled. The sheet must be shared as “anyone with the link can view”.',
      },
      { key: 'every', label: 'Read every (seconds)', type: 'number', default: 10, help: 'Five is the floor. Google allows sixty reads a minute.' },
    ],
    create: (context) => {
      // The shape is the studio's and the copy is the operator's. `...sheet` puts the
      // studio's range and header beyond reach of the panel; the line after it hands
      // the id back, because that one *is* on the panel now.
      //
      // Blank falls through to the studio's rather than being stored as empty, so an
      // operator who opens the panel to change the read interval does not silently
      // pin the sheet to whatever it was that day.
      const chosen = idFrom(context.config?.id) || sheet.id || ''
      const plugin = new GoogleSheets({ ...context, config: { ...context.config, ...sheet, id: chosen } })

      new Handler({ ...context, plugin }).attach(plugin.events)

      return plugin
    },
  })
