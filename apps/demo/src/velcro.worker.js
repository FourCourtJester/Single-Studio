import { createVelcroHost } from '@single-studio/core/worker'
import { WebsocketProvider } from 'y-websocket'

import { STUDIO_ID } from './config'
import { mutations } from './mutations'

// The SharedWorker entry. This is the whole plugin mechanism for state:
// the studio hands its own mutations to the host at startup, so there is no
// dynamic import of a conventional path and nothing is discovered by globbing.
//
// React is deliberately absent from this module -- it is a separate bundle.

// Collaboration is off unless a relay was configured at build time, so the default
// build is exactly the offline studio it was before. The URL is a build-time
// constant here only because a SharedWorker cannot see the page's URL; a studio
// that wants to switch rooms at runtime can call `sync.attach({ room })` instead.
const relay = import.meta.env.VITE_RELAY_URL

createVelcroHost({
  name: STUDIO_ID,
  mutations,
  sync: relay
    ? {
        url: relay,
        room: import.meta.env.VITE_RELAY_ROOM ?? STUDIO_ID,
        token: import.meta.env.VITE_RELAY_TOKEN,
        connect: ({ doc, url, room, token, report }) => {
          const provider = new WebsocketProvider(url, room, doc, { params: token ? { token } : {} })

          // The provider knows when it is genuinely connected; the seam only
          // guesses when nothing tells it otherwise.
          provider.on('status', ({ status }) => report(status === 'connected' ? 'connected' : 'connecting'))
          provider.on('connection-error', (event) => report('error', event?.message ?? 'relay unreachable'))

          return provider
        },
      }
    : undefined,
})
