// YOURS — what the show connects to: plugins, and collaboration.
import { createVelcroHost } from '@single-studio/core/worker'
import { connectSupabase } from '@single-studio/provider-supabase'

import { STUDIO_ID } from './config'
import { mutations } from '../mutations'

// The SharedWorker that owns this studio's state. Keep React out of this file --
// it is a separate bundle from your UI.
//
// It is also the whole plugin mechanism for state: the studio hands its own
// mutations to the host at startup, so nothing is discovered by globbing and
// nothing has to live at a conventional path.

/**
 * How this studio reaches other operators, and why it is wired up from the start.
 *
 * Nothing connects until somebody pastes a link, so this costs you nothing on a
 * one-machine show -- and it cannot be added later without a redeploy, because a
 * `connect` that is absent at build time is a collaboration button that does not
 * exist. Leaving it in means the day somebody says "can my producer drive the
 * lower third", the answer is a link rather than a release.
 *
 * The address is never baked in. A studio deploys as static files and holds no
 * keys, so the board reads where to go from its own URL -- which is what makes an
 * invite link the whole of an operator's setup. See useRelay.
 */
const connect = (context) => {
  // A Supabase project reference resolves to https. Anything else is somebody's own
  // relay, which this template does not carry a client for.
  if (!/^https?:/.test(context.url)) {
    throw new Error(
      `This studio only knows how to reach a Supabase project, and ${context.url} is not one. To run your own relay, add y-websocket and a branch here.`,
    )
  }

  return connectSupabase(context)
}

createVelcroHost({
  name: STUDIO_ID,
  mutations,
  sync: { connect },

  /**
   * Runs once the show has been read back from disk, before anything is on air.
   *
   * `mutate` is the same dispatcher a board gets from `useVelcroMutate`, so data a
   * studio owns rather than an operator -- a scoring feed, a socket, a clock of
   * your own -- lands through the same registry and replicates the same way.
   *
   * Here rather than on a page because there is one worker and there may be five
   * open boards: a poll started on a page runs once per tab, five fetches racing
   * for the same paths. Delete this if nothing but people writes to your show.
   */
  onReady({ mutate, owns }) {
    if (!import.meta.env.VITE_FEED_URL) return

    setInterval(async () => {
      // One machine talks to the outside world. `owns()` goes false once somebody
      // else in the room has ticked "This machine runs OBS", and they are then the
      // one polling -- everyone else gets the same data through replication a
      // moment later. Without this a five-operator show is five times the API
      // quota and five writers racing on the same paths, and it looks perfect in
      // testing because you test it alone.
      if (!owns()) return

      try {
        const response = await fetch(import.meta.env.VITE_FEED_URL)

        mutate('my:feed', await response.json())
      } catch (error) {
        // A feed that is down must not take the show with it. The last values it
        // sent are still on air, which is the right thing for them to be.
        console.warn('[studio] feed unreachable', error)
      }
    }, 5000)
  },
})
