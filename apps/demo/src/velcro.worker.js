import { createVelcroHost } from '@single-studio/core/worker'
import { connectSupabase } from '@single-studio/provider-supabase'
import { WebsocketProvider } from 'y-websocket'

import { STUDIO_ID } from './config'
import { mutations } from './mutations'

// The SharedWorker entry. This is the whole plugin mechanism for state:
// the studio hands its own mutations to the host at startup, so there is no
// dynamic import of a conventional path and nothing is discovered by globbing.
//
// React is deliberately absent from this module -- it is a separate bundle.

/**
 * Whichever transport the address turns out to be.
 *
 * A studio deploys as static files and we hold no keys, so what an operator has is
 * whatever they signed up for -- and asking them which *kind* of thing they pasted
 * is a question they should not have to answer. The address already says:
 *
 *   https://xyz.supabase.co   a Supabase project, with its anon key
 *   wss://relay.example.com   a y-websocket relay, theirs or packages/relay
 *
 * A studio that only ever uses one can of course pass one `connect` and skip this.
 */
const connect = (context) => {
  const { doc, url, room, token, report } = context

  if (/^https?:/.test(url)) return connectSupabase(context)

  const provider = new WebsocketProvider(url, room, doc, { params: token ? { token } : {} })

  // The provider knows when it is genuinely connected; the seam only guesses when
  // nothing tells it otherwise.
  provider.on('status', ({ status }) => report(status === 'connected' ? 'connected' : 'connecting'))
  provider.on('connection-error', (event) => report('error', event?.message ?? 'relay unreachable'))

  return provider
}

// The studio always knows *how* to join a room and never where, unless a build
// says so. A relay baked into the build cannot be changed without a redeploy, and
// the board reads its address from its own URL instead -- which is what makes an
// invite link the whole of an operator's setup. See useRelay.
const preset = import.meta.env.VITE_RELAY_URL

createVelcroHost({
  name: STUDIO_ID,
  mutations,
  sync: {
    url: preset,
    room: import.meta.env.VITE_RELAY_ROOM ?? STUDIO_ID,
    token: import.meta.env.VITE_RELAY_TOKEN,

    // Nothing happens until somebody says where. With a build-time address that is
    // immediately; otherwise it is whenever a link arrives.
    autoConnect: Boolean(preset),

    connect,
  },
})
