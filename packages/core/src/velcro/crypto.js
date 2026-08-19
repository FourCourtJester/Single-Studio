// End-to-end encryption for a show, with a key nobody but the operators holds.
//
// What this is for. Collaboration rides a Supabase project's broadcast channel,
// and that project's anon key is public by design -- it ships in the page of every
// Supabase app ever built. Until now the only thing standing between a stranger
// and a show was the room name: one guessable string, sent in the clear, to a
// company that could read every frame of it. That is a thin thing to be resting a
// production on when the document holds guest names, sponsor copy and scores
// before anybody is meant to see them.
//
// With a key, the transport carries bytes it cannot read. Supabase relays a show
// it has no view of, the room name stops being the only secret, and -- because
// AES-GCM authenticates as well as encrypts -- a peer without the key cannot
// *write* to the show either. Guessing the room no longer gets you in.
//
// Why it is available here and not on a self-hosted relay. `packages/relay` holds
// a replica so a late joiner gets the show without another machine being awake.
// A relay that cannot read updates cannot maintain that replica. On Supabase
// nothing holds a replica in the first place -- the mesh already pays that cost --
// so encryption there is free. That asymmetry is the whole reason this landed now
// and not when it was first considered.
//
// What it does not do: revocation. Encrypting cannot un-tell somebody a key they
// already have. Removing a person means a new room and a new key, which is one
// fresh link to send -- see docs/collaborating.md.

/**
 * 128 bits, generated rather than typed -- nobody invents a good passphrase under
 * pressure, and a weak one here would look like protection while being a dictionary
 * away from nothing.
 *
 * It was 256, which was an unexamined choice of mine and cost twenty-one characters
 * in every invite link somebody has to send. AES-128-GCM is the NIST minimum and is
 * beyond brute force by any margin that means anything: the threat here is a person
 * guessing a link, not an adversary with a datacentre and a century. Nothing else
 * in the design leans on the key being longer.
 *
 * Keys already minted at 256 bits still work -- `looksLikeSecret` takes both -- so
 * an invite link handed out yesterday keeps opening the show it was made for.
 */
const SECRET_BYTES = 16

/**
 * Frame header: a magic byte and a version.
 *
 * The magic is deliberately >= 0x80. A plaintext frame begins with a lib0 varuint
 * of 0 or 1 -- the sync and awareness message types -- so a single leading byte is
 * enough to tell "encrypted" from "not" with no ambiguity at all. That matters more
 * than it sounds: it is what lets a peer *refuse* a plaintext frame instead of
 * quietly applying it, which is the difference between encryption and the
 * appearance of it.
 */
const MAGIC = 0xe5
const VERSION = 0x01
const IV_BYTES = 12
const HEADER = 2 + IV_BYTES

const bytes = () => globalThis.crypto
const subtle = () => globalThis.crypto?.subtle

/** Whether this context can do any of it. `crypto.subtle` needs a secure origin. */
export const canEncrypt = () => Boolean(subtle())

/** URL-safe base64, because a secret's whole job is to live in a link. */
function toBase64Url(raw) {
  let binary = ''

  for (const byte of raw) binary += String.fromCharCode(byte)

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')

  return Uint8Array.from(atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '=')), (char) => char.charCodeAt(0))
}

/** A fresh room key, as the 22 characters that will ride an invite link's fragment. */
export function newSecret() {
  return toBase64Url(bytes().getRandomValues(new Uint8Array(SECRET_BYTES)))
}

/** 22 characters for a 128-bit key, 43 for the 256-bit ones minted before it. */
export const looksLikeSecret = (secret) => typeof secret === 'string' && /^(?:[A-Za-z0-9_-]{22}|[A-Za-z0-9_-]{43})$/.test(secret)

/** True for a frame this module produced, false for anything the mesh sent in the clear. */
export const isSealed = (frame) => frame?.length > HEADER && frame[0] === MAGIC

/**
 * Ordered async work.
 *
 * Sealing is asynchronous and sending is not, so without this a burst of edits
 * would reach the wire in whatever order the crypto happened to finish in. Yjs
 * survives that -- it parks an update whose dependencies have not arrived -- but
 * "survives" means a value can sit missing until something else happens to fill the
 * gap, and a value missing on air is the failure this whole system is built to
 * avoid. One chain, so bytes leave in the order they were made.
 */
export function sequence() {
  let tail = Promise.resolve()

  return (work) => {
    tail = tail.then(work).catch((error) => console.error('[velcro] sealed transport', error))

    return tail
  }
}

/**
 * Seal and open frames with a room key.
 *
 * AES-GCM with a random 96-bit nonce per frame. The nonce is random rather than a
 * counter because there is no counter a mesh could agree on -- every peer seals
 * independently, and a shared counter would need the coordination this design does
 * not have. Random 96-bit nonces are safe well past the number of frames a show
 * could produce: a board sending ten a second for a twelve-hour broadcast is under
 * half a million, and the birthday bound sits around four billion.
 */
export function createCipher(secret) {
  if (!looksLikeSecret(secret)) throw new Error('That is not a room key: expected 22 url-safe characters, or 43 for one minted earlier. See newSecret()')
  if (!subtle()) throw new Error('This browser cannot encrypt here: crypto.subtle needs a secure origin (https, or localhost)')

  // Imported once and reused. Non-extractable, so nothing can read it back out of
  // the worker even if something else ends up running there.
  const key = subtle().importKey('raw', fromBase64Url(secret), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])

  return {
    async seal(plain) {
      const iv = bytes().getRandomValues(new Uint8Array(IV_BYTES))
      const sealed = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, await key, plain))
      const frame = new Uint8Array(HEADER + sealed.length)

      frame[0] = MAGIC
      frame[1] = VERSION
      frame.set(iv, 2)
      frame.set(sealed, HEADER)

      return frame
    },

    /**
     * Throws on anything it did not produce, and that is the point.
     *
     * A frame in the clear means somebody is in this room without the key. Applying
     * it would be a silent downgrade -- the show would keep working, everyone would
     * believe it was encrypted, and it would not be. Refusing is the only honest
     * answer, and the caller turns it into something an operator can read.
     */
    async open(frame) {
      if (!isSealed(frame)) throw new Error('unsealed')
      if (frame[1] !== VERSION) throw new Error(`sealed by a newer version (${frame[1]})`)

      return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: frame.subarray(2, HEADER) }, await key, frame.subarray(HEADER)))
    },
  }
}
