import { ALERT_MS } from '../components/twitch'

/**
 * Twitch, as this show uses it: a chat box and a queue of alerts.
 *
 * Both are collections -- one path per message, one per alert -- written by `append`,
 * whose keys sort back into the order things arrived on every machine. Each mutation
 * adds and trims in the same change, so the graphics never see a seventh line
 * appear and then the first one go.
 *
 * The worker's Twitch handler calls these for real events, and the board's Try it
 * buttons call them with made-up ones. Same mutation either way, so what a visitor
 * sees from a button is exactly what their channel would put on air.
 */

const CHAT = 'variables.twitch.chat'
const ALERTS = 'variables.twitch.alerts'

/** Lines in the chat box. Enough to follow a conversation, few enough to read at a glance. */
const CHAT_LINES = 6

/** Alerts kept, shown or waiting. The shown ones are only kept so the queue knows where it ends. */
const ALERTS_KEPT = 12

/**
 * The furthest ahead an alert may be queued.
 *
 * Without a limit, a follow bot -- fifty follows in a minute, which happens -- queues
 * five minutes of alerts and holds every real one behind them. Past this, the alert is
 * dropped rather than queued: it still happened, but it is no longer news.
 */
const BACKLOG_MS = 5 * ALERT_MS

/** Drop all but the newest `keep` members of a collection. */
function trim(ctx, prefix, keep) {
  const members = ctx.list(prefix)
  // Not `slice(0, -keep)` for every case: with keep at 0 that is `slice(0, -0)`,
  // which is nothing at all, and Clear would clear nothing.
  const stale = keep > 0 ? members.slice(0, -keep) : members

  if (stale.length) ctx.write(stale.map(([key]) => [`${prefix}.${key}`, undefined]))
}

/** The parts of a message fragment a graphic draws. Twitch sends a good deal more. */
const fragmentOf = (fragment) => ({
  type: fragment?.type ?? 'text',
  text: fragment?.text ?? '',
  ...(fragment?.emote?.id ? { emote: { id: String(fragment.emote.id) } } : {}),
})

export const twitch = {
  /** One chat message onto the box, the oldest off it. */
  /** @param {any} ctx @param {{ name?: string, colour?: string, text?: string, fragments?: object[] }} message */
  'twitch:chat'(ctx, { name, colour, text, fragments }) {
    ctx.run('append', {
      path: CHAT,
      value: { name: name || 'Someone', colour: colour || '', text: text ?? '', fragments: (fragments ?? []).map(fragmentOf) },
    })
    trim(ctx, CHAT, CHAT_LINES)
  },

  /**
   * One alert, queued behind any still showing.
   *
   * Each alert is given its own slot -- when it starts, when it ends -- in the room's
   * time, at the moment it is queued. The graphic only has to show whichever slot
   * contains now, so every machine shows the same alert at the same moment, and one
   * opened mid-alert joins it partway rather than starting it again.
   */
  /** @param {any} ctx @param {{ kind: string, name?: string, detail?: string, text?: string }} alert */
  'twitch:alert'(ctx, { kind, name, detail, text }) {
    const now = ctx.now()
    const last = ctx.list(ALERTS).at(-1)?.[1]
    const start = Math.max(now, Number(last?.until ?? 0))

    if (start - now > BACKLOG_MS) return

    ctx.run('append', {
      path: ALERTS,
      value: { kind, name: name || 'Someone', detail: detail ?? '', text: text ?? '', start, until: start + ALERT_MS },
    })
    trim(ctx, ALERTS, ALERTS_KEPT)
  },

  /** Empty the chat box and drop any alerts still waiting. */
  'twitch:clear'(ctx) {
    trim(ctx, CHAT, 0)
    trim(ctx, ALERTS, 0)
  },
}
