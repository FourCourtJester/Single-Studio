// Signing in to Twitch from a page with nowhere to keep a secret.
//
// A studio is static files, so it is what Twitch calls a *public client*, and a
// public client gets exactly one way to sign in: the Device Code Flow. The plugin
// asks for a code, the operator types it at twitch.tv/activate on any device, and the
// plugin asks until Twitch says yes. That suits an OBS dock better than a redirect
// would anyway: nothing has to find its way back into the dock.
//
// Kept apart from the socket so every step is testable with a fake `fetch`, and so
// the part of this plugin that depends on Twitch's wording is in one place.
//
// Confirmed from a browser page against real Twitch, before any of this was built:
// the device endpoint, the token endpoint and Helix all answer a cross-origin call,
// so this needs no backend. Two properties of the refresh token are built around
// below: it is single use, and it expires after thirty days unused.

const ID = 'https://id.twitch.tv/oauth2'

const GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

const form = (fields) => ({ method: 'POST', body: new URLSearchParams(fields) })

/** What Twitch says went wrong, whichever field it put it in. */
const reasonOf = (body, status) => String(body?.message ?? body?.error_description ?? body?.error ?? `Twitch answered ${status}`)

async function read(response) {
  return response.json().catch(() => ({}))
}

/** A token response, in the shape the plugin stores. */
const tokensOf = (body, now) => ({
  token: body.access_token,
  refresh: body.refresh_token ?? '',
  expiresAt: now + Number(body.expires_in ?? 0) * 1000,
})

/**
 * Ask for a code to show the operator.
 *
 * @returns {Promise<{ deviceCode: string, userCode: string, uri: string, interval: number, expiresAt: number }>}
 */
export async function requestCode({ clientId, scopes, fetch = globalThis.fetch, now = Date.now() }) {
  const response = await fetch(`${ID}/device`, form({ client_id: clientId, scopes: scopes.join(' ') }))
  const body = await read(response)

  if (!response.ok) throw new Error(`Twitch would not start a sign-in: ${reasonOf(body, response.status)}`)

  return {
    deviceCode: body.device_code,
    userCode: body.user_code,
    uri: body.verification_uri ?? 'https://www.twitch.tv/activate',
    interval: Number(body.interval ?? 5),
    expiresAt: now + Number(body.expires_in ?? 1800) * 1000,
  }
}

/**
 * Ask once whether the operator has approved the code yet.
 *
 * Three answers, because two of Twitch's refusals are not failures: "not yet" and
 * "slower", which the caller turns into waiting. Anything else -- denied, expired,
 * a code Twitch no longer recognises -- ends the sign-in, with Twitch's reason.
 *
 * @returns {Promise<{ pending?: boolean, slowDown?: boolean, token?: string, refresh?: string, expiresAt?: number }>}
 *   `pending` or `slowDown`, or the three token fields. One shape rather than a union,
 *   so a caller can test for each without narrowing first.
 */
export async function pollToken({ clientId, scopes, deviceCode, fetch = globalThis.fetch, now = Date.now() }) {
  const response = await fetch(`${ID}/token`, form({ client_id: clientId, scopes: scopes.join(' '), device_code: deviceCode, grant_type: GRANT }))
  const body = await read(response)

  if (response.ok && body.access_token) return tokensOf(body, now)

  const reason = reasonOf(body, response.status)

  if (/authorization_pending/i.test(reason)) return { pending: true }
  if (/slow_down/i.test(reason)) return { slowDown: true }

  throw new Error(`Sign-in did not complete: ${reason}`)
}

/**
 * Swap a refresh token for a fresh pair.
 *
 * The old refresh token stops working the moment this succeeds, so the caller has
 * to store the new one before anything else can go wrong. A refusal means the
 * operator is signed out -- thirty days unused, a password change, access revoked on
 * Twitch -- and is marked so, because the answer to it is a button, not a retry.
 */
export async function refreshTokens({ clientId, refresh, fetch = globalThis.fetch, now = Date.now() }) {
  const response = await fetch(`${ID}/token`, form({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refresh }))
  const body = await read(response)

  if (response.ok && body.access_token) return tokensOf(body, now)

  /** @type {Error & { signedOut?: boolean }} */
  const problem = new Error(`Twitch has signed this machine out (${reasonOf(body, response.status)}). Sign in again.`)

  problem.signedOut = response.status === 400 || response.status === 401

  throw problem
}

/**
 * Who a token belongs to, which is how the plugin learns the operator's user id
 * without asking them for a number nobody knows.
 *
 * @returns {Promise<{ userId: string, login: string } | null>} null for a token Twitch no longer accepts
 */
export async function whoIs({ token, fetch = globalThis.fetch }) {
  const response = await fetch(`${ID}/validate`, { headers: { Authorization: `OAuth ${token}` } })

  if (response.status === 401) return null

  const body = await read(response)

  if (!response.ok) throw new Error(`Twitch would not say who this is: ${reasonOf(body, response.status)}`)

  return { userId: String(body.user_id), login: String(body.login ?? '') }
}

/** Tell Twitch the token is finished with. Best effort: signing out locally does not wait on it. */
export async function revoke({ clientId, token, fetch = globalThis.fetch }) {
  try {
    await fetch(`${ID}/revoke`, form({ client_id: clientId, token }))
  } catch {
    // Offline, or Twitch unreachable. The token expires on its own.
  }
}
