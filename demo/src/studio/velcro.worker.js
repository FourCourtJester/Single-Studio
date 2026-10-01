import { createVelcroHost } from '@single-studio/core/worker'
import { twitch, TwitchHandler } from '@single-studio/plugin-twitch'
import { connectSupabase } from '@single-studio/provider-supabase'

import { STUDIO_ID } from './config'
import { mutations } from '../mutations'

// The worker that owns this studio's state, shared by every tab. No React in here.

/**
 * How this studio reaches other operators.
 *
 * Nothing connects until somebody pastes an invite link, so a one-machine show
 * costs nothing -- but leaving this in is what lets a producer join later without a
 * redeploy.
 */
const connect = (context) => {
  // This template ships a Supabase client and nothing else.
  if (!/^https?:/.test(context.url)) {
    throw new Error(
      `This studio only knows how to reach a Supabase project, and ${context.url} is not one. To run your own relay, add y-websocket and a branch here.`,
    )
  }

  return connectSupabase(context)
}

/**
 * Twitch, onto the chat box and the alerts.
 *
 * One line per event: the handler only turns Twitch's shapes into this show's
 * words, and src/mutations/twitch.js decides what that does on air. Gifted subs
 * arrive twice -- once per recipient as a subscribe, once as the gift -- so only
 * the gift is announced, or fifty gifted subs would be fifty alerts.
 */
class Stream extends TwitchHandler {
  onChat({ from, text, fragments, colour }) {
    this.mutate('twitch:chat', { name: from?.name, colour, text, fragments })
  }

  onFollow({ from }) {
    this.mutate('twitch:alert', { kind: 'follow', name: from?.name })
  }

  onSubscribe({ from, tier, gifted }) {
    if (gifted) return

    this.mutate('twitch:alert', { kind: 'subscribe', name: from?.name, detail: `Tier ${tier}` })
  }

  onResub({ from, months, text }) {
    this.mutate('twitch:alert', { kind: 'resub', name: from?.name, detail: months ? `${months} months` : '', text })
  }

  onGift({ from, anonymous, count }) {
    this.mutate('twitch:alert', { kind: 'gift', name: anonymous ? 'Anonymous' : from?.name, detail: `${count} ${count === 1 ? 'sub' : 'subs'}` })
  }

  onCheer({ from, anonymous, bits, text }) {
    this.mutate('twitch:alert', { kind: 'cheer', name: anonymous ? 'Anonymous' : from?.name, detail: `${bits} bits`, text })
  }

  onRaid({ from, viewers }) {
    this.mutate('twitch:alert', { kind: 'raid', name: from?.name, detail: `${viewers} ${viewers === 1 ? 'viewer' : 'viewers'}` })
  }
}

/**
 * The demo's Twitch app. A Client ID is public by design -- it ships in the build of
 * every studio that signs in to Twitch -- and it is what Twitch shows on the
 * approval screen. VITE_TWITCH_CLIENT_ID swaps in your own.
 */
const TWITCH_CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID || 'k2o5ty3iracsimmlqstdhxfnlbwiiu'

createVelcroHost({
  name: STUDIO_ID,
  mutations,
  plugins: [twitch(Stream, { clientId: TWITCH_CLIENT_ID })],
  sync: { connect },

  /**
   * Runs once the show has loaded, before anything is on air.
   *
   * For data your studio owns rather than an operator: a scoring feed, a socket, a
   * clock of your own. Delete it if only people write to your show.
   */
  onReady({ mutate, owns }) {
    if (!import.meta.env.VITE_FEED_URL) return

    setInterval(async () => {
      // Only the machine running OBS fetches. Everyone else gets the same data a
      // moment later, replicated.
      if (!owns()) return

      try {
        const response = await fetch(import.meta.env.VITE_FEED_URL)

        mutate('my:feed', await response.json())
      } catch (error) {
        // A feed that is down leaves the last values it sent on air.
        console.warn('[studio] feed unreachable', error)
      }
    }, 5000)
  },
})
