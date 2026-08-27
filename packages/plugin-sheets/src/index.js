import { definePlugin, PluginHandler, PollingService } from '@single-studio/core/worker'

import { explain, parse, urlFor } from './sheet'

export { explain, keyOf, parse, same, urlFor } from './sheet'

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
class Sheets extends PollingService {
  static serviceName = 'sheets'

  /** Google allows sixty reads a minute per user. One a second is a limit waiting. */
  get floorSeconds() {
    return 5
  }

  async read() {
    const response = await fetch(urlFor({ id: this.config.id, range: this.config.range, key: this.config.key }))
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
    summary: 'Reads a spreadsheet, so anybody on the team can update the show from a browser.',
    help: [
      { type: 'text', text: 'Two things are needed: the sheet has to be readable by anyone with its link, and you need a Google API key.' },
      {
        type: 'steps',
        items: [
          'Open the sheet, press Share, and set General access to "Anyone with the link" as a Viewer.',
          'Copy the long id out of the sheet’s address — it is the part between /d/ and /edit.',
          'Go to console.cloud.google.com, make a project if you have none, and enable the Google Sheets API for it.',
          'Under APIs & Services → Credentials, create an API key and paste it above.',
          'Set the range to the cells you want, like Standings!A1:D20.',
        ],
      },
      { type: 'link', href: 'https://console.cloud.google.com/apis/credentials', label: 'Google Cloud credentials' },
      {
        type: 'note',
        text: 'The key only ever reads, and only what the sheet’s own sharing already allows. It is worth restricting it to the Sheets API in the Cloud console.',
      },
      { type: 'text', text: 'The first row is used as column names by default, so a heading of "Team Name" becomes teamName in your graphics.' },
    ],
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
