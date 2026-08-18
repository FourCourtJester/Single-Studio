import { useCallback, useEffect, useMemo, useState } from 'react'

import { useVelcro } from './useVelcro'

const OFFLINE = { state: 'offline', room: null, detail: null }

/**
 * Whether this machine is reaching the room, and which room.
 *
 * `offline` is the honest answer for a studio with no relay configured as well as
 * for one whose relay is unreachable, and the difference matters to an operator:
 * the first is how it is meant to work, the second is a problem. `configured`
 * separates them.
 */
export function useSyncStatus() {
  const velcro = useVelcro()
  const [status, setStatus] = useState(OFFLINE)

  useEffect(() => velcro.onSyncStatus(setStatus), [velcro])

  return useMemo(
    () => ({
      ...status,
      configured: Boolean(status.room),
      connected: status.state === 'connected',
      // A relay that is down is not a broadcast problem -- the graphics keep
      // rendering from this machine's own document -- but it is an operator
      // problem, and they must never have to guess.
      degraded: status.state === 'error' || status.state === 'connecting',
    }),
    [status],
  )
}

/**
 * Everyone in the room, this machine included.
 *
 * One entry per *machine*, not per tab: a dock and a dozen browser sources share
 * one worker and therefore one identity.
 */
export function usePresence() {
  const velcro = useVelcro()
  const [peers, setPeers] = useState([])

  useEffect(() => velcro.onPresence(setPeers), [velcro])

  return peers
}

/** Say who is at this board. Merged, so a caller can set one field. */
export function usePresent() {
  const velcro = useVelcro()

  return useCallback((state) => velcro.present(state), [velcro])
}

/**
 * Who else has this path open, excluding yourself.
 *
 * The staged-edit model is what makes this cheap: an edit is already local until
 * saved, and a dirty field's staged value already wins over the store, so warning
 * an operator that somebody else is in the same field is a matter of saying so --
 * no locking scheme, and nothing that can wedge a board mid-show.
 */
export function usePathPresence(path) {
  const peers = usePresence()

  return useMemo(() => (path ? peers.filter((peer) => !peer.self && peer.editing?.includes(path)) : []), [peers, path])
}
