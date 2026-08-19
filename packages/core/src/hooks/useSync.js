import { useCallback, useEffect, useMemo, useState } from 'react'

import { useVelcro } from './useVelcro'

const OFFLINE = { state: 'offline', room: null, url: null, detail: null, offset: 0, reference: false }

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
      // Having somewhere to connect to, not having a room name. A studio may name
      // its own room in its build and still have no address, which is not
      // configured -- it is a studio that has never been told where anyone is.
      configured: Boolean(status.url),
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
 * Milliseconds to add to this machine's clock to get the room's.
 *
 * Zero alone, zero in a room with no clock reference, and zero on the reference
 * itself -- so a component using this is not branching on whether collaboration is
 * on, it is just adding a number that is usually nought.
 *
 * Narrower than `useSyncStatus` on purpose: clocks are read by graphics, and a
 * graphic re-rendering because somebody else's connection wobbled would be a frame
 * of work for nothing. Setting the same number is not a render.
 */
export function useClockOffset() {
  const velcro = useVelcro()
  const [offset, setOffset] = useState(0)

  useEffect(() => velcro.onSyncStatus((status) => setOffset(status.offset ?? 0)), [velcro])

  return offset
}

/** Tell the worker whether this machine is the one everyone sets their watch by. */
export function useSetClock() {
  const velcro = useVelcro()

  return useCallback((reference) => velcro.setClock(reference), [velcro])
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
