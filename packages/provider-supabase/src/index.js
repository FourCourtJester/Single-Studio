import { createClient } from '@supabase/supabase-js'

import { createMeshProvider } from './mesh.js'
import { createSealedWire } from './sealed.js'

// Collaboration over a service the user owns, with a key we never hold.
//
// Supabase Realtime because of what it does *not* need: broadcast channels work
// straight from the browser with a project's anon key, so there is no backend to
// deploy and nothing to keep running. A user makes a free project, copies two
// values, and that is the setup. Compare the alternatives:
//
//   Pusher       client-to-client needs private channels, which need an auth
//                endpoint -- a backend, which is the thing being avoided.
//   Trystero     genuinely zero setup, but WebRTC cannot be created in a
//                SharedWorker, and the whole store lives in one. It would need a
//                main-thread socket bridged into the worker plus a rule for which
//                tab owns it. Worth doing later; not the first rung.
//   Own relay    packages/relay, for anyone who wants their own. One deploy.
//
// The anon key is public by design -- it is in the page of every Supabase app
// ever shipped -- and it is the *user's* key in the user's project.
//
// Which is exactly why a room can be sealed. With `seal`/`open` supplied, every
// frame is encrypted before it reaches Supabase and decrypted after it leaves, so
// what the service relays is bytes it cannot read: the room name stops being the
// only thing guarding a show, and -- because the sealing authenticates as well as
// encrypts -- guessing the room no longer lets anybody write to it either. Nothing
// here knows how that is done. It is handed two functions. See velcro/crypto.js.

const CHANNEL = (room) => `single-studio:${room}`
const EVENT = 'y'

/** Bytes do not survive JSON, so they travel as base64. */
const encode = (bytes) => btoa(String.fromCharCode(...bytes))
const decode = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0))

/**
 * A `connect` for `createVelcroHost({ sync })`.
 *
 * Reads the same three things an invite link already carries, so nothing else
 * changes: `url` is the Supabase project URL, `token` is its anon key, and `room`
 * is the show.
 */
export function connectSupabase({ doc, url, room, token, report, seal, open, isSealed }) {
  if (!url || !token) throw new Error('Supabase needs a project URL and its anon key')

  const client = createClient(url, token, {
    auth: { persistSession: false },
    // A busy board is a handful of messages a second, not a stream. The default
    // cap is lower than a scoreboard being tapped quickly.
    realtime: { params: { eventsPerSecond: 40 } },
  })

  const channel = client.channel(CHANNEL(room), {
    config: {
      // Our own messages come back to us otherwise, and a peer applying its own
      // update as if it were remote is a loop with extra steps.
      broadcast: { self: false },
      presence: { key: String(doc.clientID) },
    },
  })

  // Late-bound both ways on purpose: the wire needs somewhere to hand decrypted
  // bytes, and the mesh needs somewhere to hand bytes for the wire. Neither can be
  // built first, and an arrow costs nothing.
  const wire = createSealedWire({
    seal,
    open,
    isSealed,
    report,
    // Supabase answers with a status rather than throwing, so a refused broadcast --
    // a rate limit hit by a paste that turns into fifty mutations, a channel that
    // went away underneath us -- looks exactly like a successful one. Turning it
    // into a rejection is what lets anything upstream notice.
    toTransport: async (bytes) => {
      const result = await channel.send({ type: 'broadcast', event: EVENT, payload: { b: encode(bytes) } })

      if (result !== 'ok') throw new Error(`Supabase would not broadcast: ${result}`)
    },
    toMesh: (bytes) => mesh.receive(bytes),
  })

  const mesh = createMeshProvider({ doc, report, name: 'supabase', send: wire.send })

  channel.on('broadcast', { event: EVENT }, ({ payload }) => {
    if (payload?.b) wire.receive(decode(payload.b))
  })

  // Somebody new arrived. Saying hello again is cheap and saves them a round trip
  // -- and covers the case where their own hello landed before we were listening.
  channel.on('presence', { event: 'join' }, () => mesh.greet())

  // And somebody left. The presence key is the peer's own client id -- see the
  // channel config above -- so this is the transport telling us exactly whose
  // presence to drop, thirty seconds before awareness would have worked it out.
  channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) =>
    mesh.forget([key, ...(leftPresences ?? []).map((left) => left?.key)].filter(Boolean)),
  )

  report?.('connecting')

  channel.subscribe((status, error) => {
    if (status === 'SUBSCRIBED') {
      channel.track({ at: Date.now() })
      mesh.connected()

      return
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') mesh.disconnected(error?.message ?? status)
    if (status === 'CLOSED') mesh.disconnected('closed')
  })

  return {
    awareness: mesh.awareness,

    async destroy() {
      mesh.destroy()
      await channel.unsubscribe().catch(() => {})
      await client.removeAllChannels().catch(() => {})
    },
  }
}

export { createMeshProvider } from './mesh.js'
