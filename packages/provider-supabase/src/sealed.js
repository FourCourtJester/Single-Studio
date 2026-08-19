// The two directions of a sealed channel, kept apart from the transport.
//
// Extracted so it can be tested against a real cipher without a Supabase client
// anywhere near it -- and, more to the point, so what the tests exercise is the
// code that ships rather than a second copy of it written to agree with them.
//
// Knows nothing about encryption beyond having been handed two functions. The
// crypto, and the single definition of what a sealed frame looks like, live in
// core: see velcro/crypto.js.

/**
 * Ordered async work, one chain per direction.
 *
 * Sealing is asynchronous and Yjs hands over updates synchronously, so without this
 * a burst of edits reaches the wire in whatever order the crypto happened to finish
 * in. Yjs survives that -- an update whose dependencies have not arrived is parked
 * rather than lost -- but parked, on air, is a value that is not stale but missing,
 * which is the failure this whole system is built around not having.
 */
const chain = (label) => {
  let tail = Promise.resolve()

  return (work) => {
    tail = tail.then(work).catch((error) => console.error(`[${label}] sealed transport`, error))

    return tail
  }
}

/**
 * Wrap a byte channel so nothing readable leaves and nothing untrusted arrives.
 *
 * `toTransport` is handed bytes ready for the wire; `toMesh` is handed bytes ready
 * for the document. With no `seal`/`open` the two are passed straight through, so a
 * room that is not encrypted behaves exactly as it did before any of this existed --
 * same call, same tick, no promise in the way.
 */
export function createSealedWire({ seal, open, isSealed, toTransport, toMesh, report, name = 'supabase' }) {
  const sealed = Boolean(seal && open)

  // `isSealed` comes from the same place the sealing does rather than being
  // reimplemented here, because it is needed even by a board with *no* key -- that
  // is how one notices it has been handed a link that cannot read the show. Two
  // copies of the frame marker in two packages is a bug waiting for the day they
  // disagree.
  const marked = isSealed ?? (() => false)

  /**
   * Said once, not once per frame.
   *
   * A machine in the wrong state produces a complaint for every update anybody
   * makes, and a board burying its own status under a hundred identical lines has
   * told the operator nothing.
   */
  let complained = null
  const complain = (why) => {
    if (complained === why) return

    complained = why
    report?.('error', why)
  }

  if (!sealed) {
    return {
      send: toTransport,

      receive(bytes) {
        // An old link for a show that has since been sealed. Sitting there looking
        // connected and empty would send somebody hunting for a bug; the fix is a
        // new link, and they should be told so.
        if (marked(bytes)) return complain('This show is encrypted and this link has no key. Ask whoever set it up for a fresh invite link.')

        return toMesh(bytes)
      },
    }
  }

  const outbound = chain(name)
  const inbound = chain(name)

  return {
    send: (bytes) => outbound(async () => toTransport(await seal(bytes))),

    /**
     * Anything that will not open is refused rather than applied.
     *
     * The dangerous case is the second one. A peer with no key still produces
     * well-formed frames, and applying them would leave a room that works
     * perfectly, that everybody believes is sealed, and that is not. Refusing is
     * the only honest answer; saying so is what turns it into something an operator
     * can act on.
     */
    receive: (bytes) =>
      inbound(async () => {
        try {
          toMesh(await open(bytes))
        } catch (error) {
          complain(
            marked(bytes)
              ? 'This link has the wrong key for this show. Ask for a fresh invite link.'
              : 'A machine is in this room without the key, so nothing it sends can be trusted. Its edits are being ignored.',
          )
          console.error(`[${name}] refused a frame`, error?.message ?? error)
        }
      }),
  }
}
