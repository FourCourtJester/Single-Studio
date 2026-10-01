// Where an address is, in the terms browsers now gate connections by.
//
// Chrome (from 142, late 2025) blocks a page on a public site from reaching this
// computer or the network it sits on until the user allows it. That is every studio
// on GitHub Pages talking to OBS on `localhost:4455`, a game's stats port, or a
// local receiver like Single-Studio-GameState. Two details make it ours to handle
// rather than the user's:
//
// - A WebSocket never shows the "Allow" prompt; it fails, silently, with
//   ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS. Plugins are WebSockets.
// - A worker cannot ask at all, and plugins run in one. It inherits whatever the
//   studio's site was granted. Measured in Chrome 154: once the site was allowed,
//   the SharedWorker's socket connected.
//
// A plain request from a page *does* prompt (also checked in Chrome 154), which
// is what the panel's Allow button makes. This file only answers which addresses
// that applies to.

const LOOPBACK = [/^localhost$/, /\.localhost$/, /^127\.\d+\.\d+\.\d+$/, /^::1$/, /^0\.0\.0\.0$/]

const LOCAL = [
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe[89ab][0-9a-f]:/i,
  /\.local$/,
]

/**
 * Which address space a URL points into.
 *
 * `loopback` is this computer, `local` is the network it is on, `public` is
 * everything else. The split matters because Chrome now asks for the two
 * separately -- allowing one does not allow the other, which is how a site
 * "allowed" for local network access still could not reach `localhost`.
 *
 * @param {string} url
 * @returns {'loopback' | 'local' | 'public' | null} null for something that is not a URL
 */
export function addressSpace(url) {
  let host

  try {
    host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '')
  } catch {
    return null
  }

  if (LOOPBACK.some((pattern) => pattern.test(host))) return 'loopback'
  if (LOCAL.some((pattern) => pattern.test(host))) return 'local'

  return 'public'
}

/**
 * Whether a page at `from` has to ask before it can reach `to`.
 *
 * Only a step *inwards* is gated: public to local or loopback, and local to
 * loopback. A studio served from `localhost` reaching `localhost` -- the dev
 * server, or a studio served by a local program -- is never asked.
 *
 * @param {string} from the page's URL
 * @param {string} to the address being reached
 * @returns {'loopback' | 'local' | null} what would have to be allowed, or null for nothing
 */
export function gatedBetween(from, to) {
  const source = addressSpace(from)
  const target = addressSpace(to)

  if (!source || !target) return null
  if (target === 'loopback' && source !== 'loopback') return 'loopback'
  if (target === 'local' && source === 'public') return 'local'

  return null
}

/**
 * The permission names that cover a kind of address, newest first.
 *
 * Chrome has renamed this twice in a year -- `local-network-access`, then split
 * into `local-network` and `loopback-network` (its settings page now says "App
 * devices" for the second). Asked in order, the first name a browser recognises
 * wins, so an older browser answers to the old name and a newer one to its own.
 * Chromium 141 knows only `local-network-access`.
 */
export const PERMISSIONS = {
  loopback: ['loopback-network', 'local-network-access'],
  local: ['local-network', 'local-network-access'],
}

/**
 * The browser's answer for a kind of address, and the status object to watch.
 *
 * Null when it recognises none of the names, which means it does not gate these
 * connections at all -- nothing to explain and nothing to allow.
 *
 * @param {'loopback' | 'local'} kind
 * @param {Permissions | undefined} [permissions]
 * @returns {Promise<PermissionStatus | null>}
 */
export async function localPermission(kind, permissions = globalThis.navigator?.permissions) {
  if (!permissions?.query) return null

  for (const name of PERMISSIONS[kind] ?? []) {
    try {
      return await permissions.query(/** @type {any} */ ({ name }))
    } catch {
      // Not a name this browser knows. The next one may be.
    }
  }

  return null
}

/**
 * The address a page can make a plain request to, for a socket's address.
 *
 * A request to it is what brings up Chrome's prompt. It does not matter that the
 * port speaks WebSocket rather than HTTP: the permission is checked before the
 * request leaves the browser, so the request failing afterwards is expected.
 *
 * @param {string} url
 */
export function promptable(url) {
  return url.replace(/^ws(s?):/i, 'http$1:')
}
