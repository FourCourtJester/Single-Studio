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

/** `key` rather than `token` in the URL: shorter, and it reads like a house key. */
const PARAMS = { url: 'relay', room: 'room', token: 'key' }

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

    return { url: found.url, room: found.room || undefined, token: found.token || undefined }
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
export function relayLink({ url, room, token, base = typeof window === 'undefined' ? '' : window.location.href } = {}) {
  const link = new URL(base)
  const params = new URLSearchParams()

  if (url) params.set(PARAMS.url, url)
  if (room) params.set(PARAMS.room, room)
  if (token) params.set(PARAMS.token, token)

  link.search = params.toString()
  link.hash = '#/'

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

  const join = useCallback(
    (next) => {
      const cleaned = next?.url ? { url: next.url, room: next.room || undefined, token: next.token || undefined } : null

      remember(cleaned)
      setConfig(cleaned)

      if (cleaned) velcro.connectSync(cleaned)
      else velcro.disconnectSync()
    },
    [velcro],
  )

  return { config, join }
}
