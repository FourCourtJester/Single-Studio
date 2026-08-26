import { useCallback, useEffect, useState } from 'react'

import { newSecret } from '../velcro/crypto'
import { useVelcro } from './useVelcro'

// Joining a room without anybody typing a token.
//
// The constraint this exists for: a studio is static files on GitHub Pages, and an
// operator's entire setup should be pasting a URL into an OBS dock. So the room
// lives in the URL, the way a share link does everywhere else:
//
//   https://studio.example.com/#/?j=abcdefghijklmnopqrst,,.abc,SGVsbG8gdGhlcmUgeW91
//
// OBS remembers a dock's URL, so that is a once-ever step. The operator never sees
// the word "token" and never opens a settings screen.
//
// It is remembered locally on arrival, which matters more than it looks: a graphic
// opened later, or a board reloaded after the link has scrolled out of somebody's
// chat, still knows where the room is.

const KEY = 'single-studio:relay'

/**
 * Which machine sets the room's clock, kept apart from the room itself.
 *
 * It has to be a separate key. Arriving on a link overwrites the remembered room --
 * deliberately, since a new link means a new room -- and the streamer's own dock
 * arrives on a link too, because pressing Go rewrites the URL and reloads. Folded
 * into the same record, the machine running OBS would forget it was the clock the
 * instant it finished being told.
 *
 * That it does not travel in the URL is the other half: an invite link is the
 * streamer's own dock URL, so anything in it is true of everybody who opens it.
 * Being the clock is true of exactly one machine.
 */
const CLOCK = 'single-studio:clock'

/** `key` rather than `token` in the URL: shorter, and it reads like a house key. */
const PARAMS = { url: 'relay', room: 'room', token: 'key' }

/**
 * The room key, and it lives in the fragment on purpose.
 *
 * Everything before the `#` is sent to the server that hands out the page; the
 * fragment is not, and is stripped from `Referer` besides. So a link can carry the
 * one secret that actually matters without it ever reaching GitHub Pages, Supabase,
 * or anywhere in between -- which is what lets the whole of an operator's setup stay
 * "paste this link" while the show itself stays unreadable to the service carrying
 * it. The same trick every end-to-end share link uses.
 *
 * Read only from the fragment, never from the query. A key found before the `#`
 * has already been sent to a server, so honouring it would quietly bless exactly
 * the mistake this is built to prevent.
 */
const SECRET = 'k'

const remembered = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

const remember = (config) => {
  try {
    if (config) localStorage.setItem(KEY, JSON.stringify(config))
    else localStorage.removeItem(KEY)
  } catch {
    // A locked-down profile costs the convenience, not the connection.
  }
}

/** Whether this machine has been told it is the one going to air. */
export const isClock = () => {
  try {
    return localStorage.getItem(CLOCK) === 'reference'
  } catch {
    return false
  }
}

export const setClockRole = (reference) => {
  try {
    if (reference) localStorage.setItem(CLOCK, 'reference')
    else localStorage.removeItem(CLOCK)
  } catch {
    // Same bargain as above: the clock falls back to uncorrected, not to broken.
  }
}

/**
 * What a Supabase project reference looks like, and what to do with one.
 *
 * The dashboard used to show a "Project URL" to copy. It does not any more -- what
 * Project Settings shows is a Project ID, also called a reference, and the URL is
 * built from it: `https://<ref>.supabase.co`. Rather than send somebody hunting for
 * a label that has moved once and may move again, take either. A reference is
 * lowercase alphanumeric with no dots and no slashes, which nothing else somebody
 * might paste here looks like.
 *
 * Anything with a scheme is passed through untouched, so a relay of one's own still
 * works, and so does a project URL for anybody who has one to hand.
 */
const REFERENCE = /^[a-z0-9]{16,40}$/
const SUPABASE = /^https:\/\/([a-z0-9]{16,40})\.supabase\.co$/i

/**
 * The other direction: what to show somebody who typed a Project ID.
 *
 * They pasted `abcdefghijklmnopqrst` and came back to a box reading
 * `https://abcdefghijklmnopqrst.supabase.co`, which is a box that no longer matches
 * the label above it or the page it was copied from. The address is what the
 * transport needs; the reference is what the person has. Store the first, show the
 * second.
 */
export function displayRelay(value) {
  const address = SUPABASE.exec(String(value ?? '').trim())

  return address ? address[1] : (value ?? '')
}

export function resolveRelay(value) {
  const given = String(value ?? '').trim()

  if (!given) return ''
  if (/^[a-z]+:\/\//i.test(given)) return given.replace(/\/+$/, '')
  if (REFERENCE.test(given)) return `https://${given}.supabase.co`

  return given
}

/**
 * The whole room as one value, after the `#`.
 *
 * Four parameters was four things to get wrong and a URL nobody could read:
 * `?relay=https%3A%2F%2F…supabase.co&room=friday&key=sb_publishable_…#/?k=…`, most
 * of it percent-encoding and parameter names. One opaque token is shorter, and it
 * is one thing to copy.
 *
 * Not a hash -- a hash cannot be read back, and the board has to be able to. This
 * is an encoding: a compact array, base64url, no padding.
 *
 * Putting *everything* after the `#` is the part worth having. The fragment is
 * never sent to a server, so the project key stops travelling to whoever hosts the
 * page, alongside the room key that was already kept out of their reach. And a
 * Supabase address collapses back to the reference it was built from, which is most
 * of the length gone.
 */
const TOKEN = 'j'

/**
 * Joined, not encoded. Base64 was tried and was worse.
 *
 * Wrapping the four values in JSON and base64 made one opaque token that was
 * *longer* than the parameters it replaced -- base64 costs a third on top, and the
 * quotes and brackets cost more than the parameter names they saved. Measured: 177
 * characters against 165.
 *
 * A separator costs one character each. The parts are percent-encoded so nothing
 * containing one can break the split.
 *
 * A comma, specifically, because `encodeURIComponent` escapes it. The obvious
 * choice was `~` and it is silently wrong: `~` is an unreserved mark, so it comes
 * back through the encoder untouched, and an older link's room called
 * "friday ~ night" would split into pieces. The separator has to be a character the
 * encoder takes away.
 */
const JOIN = ','

/**
 * The one genuinely redundant thing in the payload.
 *
 * Compression was measured against this and lost: deflate on the joined string came
 * to 124 characters against 121, brotli 122, and packing it all into binary before
 * base64 made it 127 -- because three quarters of what is here is a random project
 * reference, a random project key and a random room key, and randomness does not
 * compress. base64's third-on-top then costs more than any of it saves.
 *
 * What *is* redundant is the fifteen characters every Supabase publishable key
 * begins with. A single leading dot stands in for it, which no real key can start
 * with -- a publishable key begins `sb_`, a legacy one is a JWT beginning `eyJ`.
 */
const KEY_PREFIX = 'sb_publishable_'
const PREFIXED = '.'

const squeezeKey = (token) => (token?.startsWith(KEY_PREFIX) ? PREFIXED + token.slice(KEY_PREFIX.length) : (token ?? ''))
const expandKey = (token) => (token?.startsWith(PREFIXED) ? KEY_PREFIX + token.slice(1) : token)

/**
 * Everything a board needs to join, as one string.
 *
 * The room slot is still here and is empty in everything made now: the room is
 * derived from the key (see `deriveRoom`), so there is nothing to carry. It stays
 * because the parts are positional -- dropping the slot would make an older link's
 * `ref,friday,key` read as `ref,<token>,…` and send a board somewhere it has no
 * business being. One character to keep every dock somebody has already set up.
 */
export function packRoom({ url, room, token, secret } = {}) {
  const address = SUPABASE.exec(String(url ?? '').trim())
  const parts = [address ? address[1] : (url ?? ''), room ?? '', squeezeKey(token), secret ?? ''].map((part) => String(part ?? ''))

  // Trailing empties carry no information and cost characters.
  while (parts.length && !parts.at(-1)) parts.pop()

  return parts.length ? parts.map(encodeURIComponent).join(JOIN) : ''
}

export function unpackRoom(value) {
  if (!value) return null

  try {
    const parts = String(value).split(JOIN).map(decodeURIComponent)
    const url = resolveRelay(parts[0])

    // Must resolve to something with a scheme, or it is not an address. A mistyped
    // token would otherwise become a room pointing confidently at nonsense, which
    // is worse than a link that plainly does not work: the board would sit there
    // failing to reach a relay nobody ever had.
    if (!/^[a-z]+:\/\//i.test(url)) return null

    return { url, room: parts[1] || undefined, token: expandKey(parts[2]) || undefined, secret: parts[3] || undefined }
  } catch {
    return null
  }
}

/** Read a room out of a URL. Both the real query and the hash query are checked. */
export function relayFromUrl(href = typeof window === 'undefined' ? '' : window.location.href) {
  if (!href) return null

  try {
    const url = new URL(href, 'http://localhost')
    const hash = url.hash.indexOf('?')
    const inHash = hash === -1 ? new URLSearchParams() : new URLSearchParams(url.hash.slice(hash + 1))
    const read = (name) => url.searchParams.get(name) ?? inHash.get(name)

    // The token if there is one; the four separate parameters if this is an older
    // link. Docks that were set up before this change keep working, and OBS
    // remembers a dock's URL for as long as the dock exists.
    const packed = unpackRoom(inHash.get(TOKEN))

    if (packed) return packed

    const found = { url: read(PARAMS.url), room: read(PARAMS.room), token: read(PARAMS.token) }

    // A relay with no room is not a room. Everything else is optional: a studio
    // that names its own room only needs the address.
    if (!found.url) return null

    return {
      url: resolveRelay(found.url),
      room: found.room || undefined,
      token: found.token || undefined,
      secret: inHash.get(SECRET) || undefined,
    }
  } catch {
    return null
  }
}

/**
 * Build the link to hand somebody.
 *
 * Deliberately the studio's own URL with the room appended, not a link to the
 * relay: what an operator needs is the board, and the room is how it finds its way
 * home. One thing to send, and it is the thing they were going to need anyway.
 */
export function relayLink({ url, room, token, secret, base = typeof window === 'undefined' ? '' : window.location.href } = {}) {
  const link = new URL(base)
  const packed = packRoom({ url, room, token, secret })

  // Nothing before the `#`. See TOKEN: one value to copy, and none of it sent to
  // whoever serves the page.
  link.search = ''
  link.hash = packed ? `#/?${TOKEN}=${packed}` : '#/'

  return link.toString()
}

/**
 * Join whatever room this page was pointed at, and stay in it.
 *
 * Returns the current configuration and a setter, so a board can also be pointed
 * at a room by hand -- the streamer's own machine has no invite link to arrive on.
 */
export function useRelay({ auto = true } = {}) {
  const velcro = useVelcro()
  const [config, setConfig] = useState(() => (typeof window === 'undefined' ? null : (relayFromUrl() ?? remembered())))
  const [reference, setReference] = useState(() => (typeof window === 'undefined' ? false : isClock()))

  useEffect(() => {
    if (!auto) return

    // An arrival wins over what was remembered: somebody sending a new link is
    // moving you to a new room, and the old one should not quietly win.
    const arriving = relayFromUrl()

    if (arriving) {
      remember(arriving)
      setConfig(arriving)
    }
  }, [auto])

  useEffect(() => {
    if (!auto || !config?.url) return

    velcro.connectSync(config)
  }, [auto, config, velcro])

  // Told every time, including when it is false. The worker outlives a reload but
  // not a change of mind, and "no longer the clock" is a thing that has to be
  // sayable or a machine demoted in the dialog would keep beating until it closed.
  useEffect(() => {
    if (!auto) return

    velcro.setClock(reference)
  }, [auto, reference, velcro])

  const join = useCallback(
    (next) => {
      const cleaned = next?.url ? { url: next.url, room: next.room || undefined, token: next.token || undefined, secret: next.secret || undefined } : null

      remember(cleaned)
      setConfig(cleaned)

      if (next?.reference !== undefined) {
        setClockRole(next.reference)
        setReference(Boolean(next.reference))
        velcro.setClock(next.reference)
      }

      if (cleaned) velcro.connectSync(cleaned)
      else velcro.disconnectSync()
    },
    [velcro],
  )

  /**
   * Leave the room and go back to working alone.
   *
   * Three things, and all three are needed. Forgetting the stored room stops the
   * next load rejoining it; rewriting the URL stops the *dock* rejoining it, which
   * is the one an operator cannot see and the one OBS remembers; and dropping the
   * clock role stops a machine that was the reference from beating into a room it
   * has left.
   */
  const leave = useCallback(() => {
    join({ reference: false })

    if (typeof window !== 'undefined') window.location.replace(relayLink({}))
  }, [join])

  /**
   * A new key, which is a new room, which is the only revocation there is.
   *
   * Nobody can be un-told a key they already hold, so shutting somebody out means a
   * key they do not have -- and because the room is derived from the key, minting
   * one moves the show somewhere the old link does not point. The document is
   * local-first, so it comes along: this machine offers its copy into an empty room
   * and nothing is reconstructed.
   *
   * Only for a show that had a key. Turning encryption *on* is a different act with
   * a different button, and doing it silently here would be a board deciding to
   * seal a show nobody asked to seal.
   */
  const rekey = useCallback(() => {
    if (!config?.url || !config.secret) return null

    const next = { ...config, secret: newSecret(), reference }

    join(next)

    if (typeof window !== 'undefined') window.location.replace(relayLink(next))

    return next
  }, [config, join, reference])

  return { config, join, leave, rekey, reference }
}
