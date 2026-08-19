import { useCallback, useEffect, useState } from 'react'

import { useVelcro } from './useVelcro'

// Joining a room without anybody typing a token.
//
// The constraint this exists for: a studio is static files on GitHub Pages, and an
// operator's entire setup should be pasting a URL into an OBS dock. So the room
// lives in the URL, the way a share link does everywhere else:
//
//   https://studio.example.com/?relay=wss://relay.example.com&room=friday&key=abc#/
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

/** Read a room out of a URL. Both the real query and the hash query are checked. */
export function relayFromUrl(href = typeof window === 'undefined' ? '' : window.location.href) {
  if (!href) return null

  try {
    const url = new URL(href, 'http://localhost')
    const hash = url.hash.indexOf('?')
    const inHash = hash === -1 ? new URLSearchParams() : new URLSearchParams(url.hash.slice(hash + 1))
    const read = (name) => url.searchParams.get(name) ?? inHash.get(name)

    const found = { url: read(PARAMS.url), room: read(PARAMS.room), token: read(PARAMS.token) }

    // A relay with no room is not a room. Everything else is optional: a studio
    // that names its own room only needs the address.
    if (!found.url) return null

    return {
      url: found.url,
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
  const params = new URLSearchParams()

  if (url) params.set(PARAMS.url, url)
  if (room) params.set(PARAMS.room, room)
  if (token) params.set(PARAMS.token, token)

  link.search = params.toString()
  // After the `#`, so it is never sent to a server. See SECRET.
  link.hash = secret ? `#/?${SECRET}=${encodeURIComponent(secret)}` : '#/'

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
      const cleaned = next?.url
        ? { url: next.url, room: next.room || undefined, token: next.token || undefined, secret: next.secret || undefined }
        : null

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

  return { config, join, reference }
}
