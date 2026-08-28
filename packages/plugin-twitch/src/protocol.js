// The EventSub WebSocket protocol, as a state machine with no socket in it.
//
// Twitch's transport has four behaviours that are easy to get subtly wrong and
// impossible to notice until a show: a keepalive watchdog, a reconnect that hands
// you a new URL and expects an overlap, replay protection, and revocation. Each is
// a rule about *when* to act rather than about parsing, so all four are here,
// away from the socket, where a test can drive them by hand.
//
// The socket wrapper feeds messages in and does what `handle` says. That split is
// what lets the whole protocol be tested in Node with no network, no credentials,
// and no waiting.

/** How long a message id is worth remembering, and how many. */
const SEEN_LIMIT = 600

/**
 * Twitch asks clients to ignore anything older than ten minutes, because a replayed
 * notification is indistinguishable from a real one to everything downstream -- a
 * subscriber alert firing again an hour later is on air before anybody can stop it.
 */
const MAX_AGE_MS = 10 * 60 * 1000

export const WELCOME = 'session_welcome'
export const KEEPALIVE = 'session_keepalive'
export const NOTIFICATION = 'notification'
export const RECONNECT = 'session_reconnect'
export const REVOCATION = 'revocation'

/**
 * What the caller should do about a message.
 *
 * @typedef {object} Action
 * @property {'ignore'|'subscribe'|'alive'|'deliver'|'reconnect'|'revoked'} do
 * @property {string} [session] Session id, on `subscribe`.
 * @property {number} [keepalive] Seconds, on `subscribe`.
 * @property {string} [url] Where to reconnect, on `reconnect`.
 * @property {string} [type] Subscription type, on `deliver` and `revoked`.
 * @property {unknown} [event] The payload, on `deliver`.
 * @property {string} [reason] Why, on `revoked` and on an ignore worth explaining.
 */

export class Protocol {
  /** Message ids already handled, oldest first. */
  #seen = new Set()

  /** @param {() => number} [now] Injectable so a test can move time without waiting. */
  constructor(now = () => Date.now()) {
    this.now = now
    this.sessionId = null
    this.keepaliveSeconds = null
  }

  /**
   * Has this id been handled before?
   *
   * Twitch may redeliver, and a bounded set is the right shape: unbounded would
   * grow for the length of a stream, and a stream is measured in hours.
   */
  #fresh(id) {
    if (this.#seen.has(id)) return false

    this.#seen.add(id)

    // Sets iterate in insertion order, so the first key is the oldest.
    if (this.#seen.size > SEEN_LIMIT) this.#seen.delete(this.#seen.values().next().value)

    return true
  }

  /**
   * Decide what a raw message means.
   *
   * @param {unknown} raw Already JSON.parse'd.
   * @returns {Action}
   */
  handle(raw) {
    const metadata = raw?.metadata
    const payload = raw?.payload

    if (!metadata?.message_type) return { do: 'ignore', reason: 'not an EventSub message' }

    const id = metadata.message_id
    const type = metadata.message_type

    // Replay protection before anything else, so a duplicate reconnect or
    // revocation is dropped as surely as a duplicate notification.
    if (id && !this.#fresh(id)) return { do: 'ignore', reason: 'already handled' }

    const at = Date.parse(metadata.message_timestamp ?? '')

    if (Number.isFinite(at) && this.now() - at > MAX_AGE_MS) {
      return { do: 'ignore', reason: 'older than ten minutes' }
    }

    switch (type) {
      case WELCOME: {
        this.sessionId = payload?.session?.id ?? null
        // Twitch closes the connection if nothing is subscribed inside this
        // window, which is short: ten seconds unless asked for otherwise.
        this.keepaliveSeconds = payload?.session?.keepalive_timeout_seconds ?? null

        return { do: 'subscribe', session: this.sessionId, keepalive: this.keepaliveSeconds }
      }

      case KEEPALIVE:
        return { do: 'alive' }

      case NOTIFICATION:
        return {
          do: 'deliver',
          type: payload?.subscription?.type ?? metadata.subscription_type ?? null,
          event: payload?.event ?? null,
        }

      case RECONNECT:
        // The old socket keeps delivering until the new one has welcomed, which is
        // the whole point of Twitch handing over a URL rather than just closing.
        return { do: 'reconnect', url: payload?.session?.reconnect_url ?? null }

      case REVOCATION:
        return {
          do: 'revoked',
          type: payload?.subscription?.type ?? null,
          reason: payload?.subscription?.status ?? 'revoked',
        }

      default:
        return { do: 'ignore', reason: `unknown message type "${type}"` }
    }
  }

  /**
   * How long to wait for *anything* before deciding the connection is dead.
   *
   * Twitch sends a keepalive whenever it has sent nothing else, so silence past
   * this is the connection being gone without a close frame -- which is the
   * failure that leaves a chat overlay looking fine and frozen.
   *
   * A margin, because a keepalive that arrives exactly on time is on time.
   */
  get silenceBudgetMs() {
    return ((this.keepaliveSeconds ?? 10) + 5) * 1000
  }
}
