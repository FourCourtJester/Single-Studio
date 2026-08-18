// Per-operator tokens, not one shared secret.
//
// A production loses operators. Somebody finishes a contract, somebody's laptop is
// stolen, somebody is simply not on this show. With one shared secret the only
// answer is to rotate it and re-tell everyone else, which is the sort of task that
// gets postponed until it is never done. One token each makes removing a person a
// single revocation, and it means the relay can say *who* is connected.
//
// A stored list rather than signed tokens, deliberately. Signing needs no state
// and is the usual advice, but revoking a signed token needs a denylist -- which
// is state again, only now you also have to reason about expiry windows during
// which a fired operator is still admitted. The audience here runs one small relay
// on a free tier; a list they can read and delete from is both simpler and more
// obviously correct.
//
// Transport-agnostic, like the room: `load` and `save` are handed in, so the same
// logic runs on Durable Object storage and on a file.

const ID_BYTES = 8
const SECRET_BYTES = 24

const random = (bytes) => {
  const buffer = new Uint8Array(bytes)

  globalThis.crypto.getRandomValues(buffer)

  return [...buffer].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Constant-time-ish comparison.
 *
 * A plain `===` on secrets leaks their length and prefix through timing. The
 * exposure here is small -- an attacker needs many attempts against a relay that
 * one person runs -- but comparing two short strings carefully costs nothing, and
 * "it was only a small leak" is not a sentence worth writing later.
 */
const same = (a, b) => {
  const left = String(a ?? '')
  const right = String(b ?? '')

  if (left.length !== right.length) return false

  let diff = 0

  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)

  return diff === 0
}

export function createTokens({ load, save } = {}) {
  /** room -> Map<id, token> */
  let rooms = null

  const loaded = Promise.resolve(load?.()).then((stored) => {
    rooms = new Map(Object.entries(stored ?? {}).map(([room, list]) => [room, new Map(list.map((token) => [token.id, token]))]))

    return rooms
  })

  const persist = () => {
    if (!save) return Promise.resolve()

    const plain = Object.fromEntries([...rooms].map(([room, list]) => [room, [...list.values()]]))

    // `Promise.resolve(save(...))` is not enough: a `save` that throws
    // synchronously does so before there is a promise to attach a catch to, and
    // the throw escapes into whoever was issuing a token. Storage failing must
    // cost persistence, never the running relay.
    return Promise.resolve()
      .then(() => save(plain))
      .catch((error) => console.error('[relay] could not persist tokens', error))
  }

  const roomOf = (room) => {
    if (!rooms.has(room)) rooms.set(room, new Map())

    return rooms.get(room)
  }

  return {
    async issue(room, { name = '', id = random(ID_BYTES), secret = random(SECRET_BYTES) } = {}) {
      await loaded

      const token = { id, secret, name, createdAt: Date.now(), revokedAt: null }

      roomOf(room).set(id, token)
      await persist()

      return token
    },

    /**
     * Never returns secrets.
     *
     * A list is for an operator to look at while deciding who to remove, and a
     * board that renders one has no use for the secrets. Handing them out on every
     * read would put every operator's credential in the DOM of whoever opened the
     * panel.
     */
    async list(room) {
      await loaded

      return [...roomOf(room).values()].map(({ secret, ...rest }) => rest)
    },

    async revoke(room, id) {
      await loaded

      const token = roomOf(room).get(id)

      if (!token || token.revokedAt) return null

      token.revokedAt = Date.now()
      await persist()

      return { ...token, secret: undefined }
    },

    /** The token a secret belongs to, or null. Revoked tokens do not match. */
    async check(room, secret) {
      await loaded

      if (!secret) return null

      for (const token of roomOf(room).values()) {
        if (token.revokedAt) continue
        if (same(token.secret, secret)) return token
      }

      return null
    },

    /** Whether this room has been locked down at all. */
    async guarded(room) {
      await loaded

      return [...roomOf(room).values()].some((token) => !token.revokedAt)
    },

    loaded,
  }
}
