import { createVelcroHost } from '@single-studio/core/worker'
import { connectSupabase } from '@single-studio/provider-supabase'
import { WebsocketProvider } from 'y-websocket'

import { STUDIO_ID } from './config'
import { mutations } from './mutations'
import { feed, FeedHandler } from './plugins/feed'

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
  const { doc, url, room, token, secret, report } = context

  if (/^https?:/.test(url)) return connectSupabase(context)

  // Refused rather than ignored. A relay holds a replica of the show so a late
  // joiner gets it without another machine being awake, which means it has to be
  // able to read what it is given -- so there is no way to honour a key here. The
  // dangerous version of this is the quiet one: sending in the clear while a board
  // shows a link with a key in it would have everyone believing the show was
  // sealed while every frame went out readable.
  if (secret)
    throw new Error(
      'This link carries a room key, and a relay cannot use one: it holds a copy of the show, so it has to be able to read it. Use a Supabase project to encrypt, or an invite link without a key.',
    )

  const provider = new WebsocketProvider(url, room, doc, { params: token ? { token } : {} })

  // The provider knows when it is genuinely connected; the seam only guesses when
  // nothing tells it otherwise.
  provider.on('status', ({ status }) => report(status === 'connected' ? 'connected' : 'connecting'))
  // y-websocket hands back a plain Event here, which carries no message of its own
  // when the failure was a refused socket rather than a close frame.
  provider.on('connection-error', (/** @type {Event & { message?: string }} */ event) => report('error', event?.message ?? 'relay unreachable'))

  return provider
}

// The studio always knows *how* to join a room and never where, unless a build
// says so. A relay baked into the build cannot be changed without a redeploy, and
// the board reads its address from its own URL instead -- which is what makes an
// invite link the whole of an operator's setup. See useRelay.
const preset = import.meta.env.VITE_RELAY_URL

/**
 * What this studio does with the demo feed.
 *
 * A handler class rather than listeners in this file: a real plugin has twenty-odd
 * events, and the worker entry should stay a manifest of what a studio is made of.
 * Overriding one method is the whole of the work.
 */
class Ticker extends FeedHandler {
  onTick({ count, label }) {
    this.mutate('set', { 'variables.feed.count': count, 'variables.feed.label': label })
  }
}

createVelcroHost({
  name: STUDIO_ID,
  mutations,
  plugins: [feed(Ticker)],
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
