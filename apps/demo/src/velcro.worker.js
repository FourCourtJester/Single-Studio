import { createVelcroHost } from '@single-studio/core/worker'
import { WebsocketProvider } from 'y-websocket'

import { STUDIO_ID } from './config'
import { mutations } from './mutations'

// The SharedWorker entry. This is the whole plugin mechanism for state:
// the studio hands its own mutations to the host at startup, so there is no
// dynamic import of a conventional path and nothing is discovered by globbing.
//
// React is deliberately absent from this module -- it is a separate bundle.

// The studio always knows *how* to join a room and never where, unless a build
// says so. A studio deploys as static files, so a relay baked into the build is one
// that cannot be changed without a rebuild -- the board reads the address from its
// own URL and hands it down instead, which is what makes an invite link the whole
// of an operator's setup. See useRelay.
//
// VITE_RELAY_URL still works, for a studio that would rather pin it.
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

    connect: ({ doc, url, room, token, report }) => {
      const provider = new WebsocketProvider(url, room, doc, { params: token ? { token } : {} })

      // The provider knows when it is genuinely connected; the seam only guesses
      // when nothing tells it otherwise.
      provider.on('status', ({ status }) => report(status === 'connected' ? 'connected' : 'connecting'))
      provider.on('connection-error', (event) => report('error', event?.message ?? 'relay unreachable'))

      return provider
    },
  },
})
