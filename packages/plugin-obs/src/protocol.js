// obs-websocket v5, as data and pure functions with no socket in them.
//
// Verified against obsproject/obs-websocket docs/generated/protocol.md rather than
// written from memory. The parts that are easy to get subtly wrong -- the auth
// hash, the subscription bitmask, request correlation -- are all here, where a test
// can check them against the worked example in that document.

/** Opcodes, both directions. */
export const OP = {
  HELLO: 0,
  IDENTIFY: 1,
  IDENTIFIED: 2,
  REIDENTIFY: 3,
  EVENT: 5,
  REQUEST: 6,
  RESPONSE: 7,
  BATCH: 8,
  BATCH_RESPONSE: 9,
}

/**
 * Event categories, as a bitmask.
 *
 * Deliberately not `All`. Its value has changed -- `Canvases` joined it in
 * obs-websocket 5.7.0 -- so "all" means different numbers to different versions of
 * OBS, and asking for categories a studio does not read is paying for events that
 * cross the socket to be discarded. A studio subscribes to what it uses.
 *
 * The high-volume ones are above 1 << 15 and are never included by default, by
 * OBS's own rule: `InputVolumeMeters` alone is dozens of messages a second.
 */
export const CATEGORY = {
  none: 0,
  general: 1 << 0,
  config: 1 << 1,
  scenes: 1 << 2,
  inputs: 1 << 3,
  transitions: 1 << 4,
  filters: 1 << 5,
  outputs: 1 << 6,
  sceneItems: 1 << 7,
  mediaInputs: 1 << 8,
  vendors: 1 << 9,
  ui: 1 << 10,
  canvases: 1 << 11,
}

/**
 * @param {string[]} names
 * @returns {number}
 */
export const maskOf = (names = []) => names.reduce((mask, name) => mask | (CATEGORY[name] ?? 0), 0)

const b64 = (bytes) => {
  let binary = ''

  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)

  return btoa(binary)
}

const sha256 = async (text) => b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))

/**
 * The answer to OBS's challenge.
 *
 * Two rounds, and the order matters in both: the password is hashed with the salt
 * to make a secret, and that secret -- base64, not raw bytes -- is hashed with the
 * challenge. Concatenating in the other order, or hashing the raw digest rather
 * than its base64, produces a string that is the right length and always wrong.
 *
 * @param {string} password
 * @param {string} salt
 * @param {string} challenge
 * @returns {Promise<string>}
 */
export async function authenticate(password, salt, challenge) {
  const secret = await sha256(password + salt)

  return sha256(secret + challenge)
}

/**
 * What to do about a message from OBS.
 *
 * @param {unknown} raw Already JSON.parse'd.
 */
export function classify(raw) {
  const op = raw?.op
  const d = raw?.d

  switch (op) {
    case OP.HELLO:
      return {
        do: 'identify',
        rpcVersion: d?.rpcVersion ?? 1,
        // Absent when OBS has authentication switched off, which is a normal
        // configuration and not an error.
        auth: d?.authentication ?? null,
        obs: d?.obsStudioVersion ?? null,
        websocket: d?.obsWebSocketVersion ?? null,
      }

    case OP.IDENTIFIED:
      return { do: 'ready', rpcVersion: d?.negotiatedRpcVersion ?? null }

    case OP.EVENT:
      return { do: 'event', type: d?.eventType ?? null, data: d?.eventData ?? {} }

    case OP.RESPONSE:
      return {
        do: 'response',
        id: d?.requestId ?? null,
        ok: Boolean(d?.requestStatus?.result),
        // `comment` is the only thing that says *why*, and it is absent on success.
        reason: d?.requestStatus?.comment ?? d?.requestStatus?.code ?? null,
        data: d?.responseData ?? {},
      }

    default:
      return { do: 'ignore', reason: `unhandled opcode ${op}` }
  }
}

/**
 * The Identify frame.
 *
 * @param {object} options
 * @param {number} options.rpcVersion
 * @param {string} [options.authentication]
 * @param {number} options.eventSubscriptions
 */
export const identify = ({ rpcVersion, authentication, eventSubscriptions }) => ({
  op: OP.IDENTIFY,
  d: {
    rpcVersion,
    ...(authentication ? { authentication } : {}),
    eventSubscriptions,
  },
})

/** A request frame. `requestId` is what correlates the reply. */
export const request = (requestType, requestId, requestData) => ({
  op: OP.REQUEST,
  d: { requestType, requestId, ...(requestData ? { requestData } : {}) },
})
