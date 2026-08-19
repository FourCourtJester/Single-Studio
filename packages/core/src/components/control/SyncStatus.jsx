import { useSyncStatus, usePresence } from '../../hooks/useSync'
import { useStudio } from '../../studio/context'
import { cx } from '../../toolkits/cx'
import { Tooltip } from '../common/Tooltip'

/**
 * Whether this board's edits are reaching anyone else.
 *
 * The most important piece of interface in the whole collaboration feature, and
 * the least interesting to build. An operator working a live show from another
 * building has to know, without asking and without thinking about it, whether what
 * they are typing is going anywhere. Ambiguity here is worse than being plainly
 * disconnected: someone who knows they are offline stops and fixes it, and someone
 * who does not spends a segment wondering why nobody is reacting.
 *
 * A studio with no relay renders nothing at all. Collaboration being absent is not
 * a state to report -- it is how a one-operator show works, and a permanent
 * "offline" badge on a board that was never meant to be online is noise that
 * teaches operators to ignore the indicator.
 */
const LOOKS = {
  connected: { dot: 'bg-emerald-400', text: 'text-slate-400', label: 'Connected' },
  connecting: { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300', label: 'Connecting…' },
  error: { dot: 'bg-rose-500', text: 'text-rose-300', label: 'Offline' },
  offline: { dot: 'bg-slate-600', text: 'text-slate-400', label: 'Local only' },
}

export function SyncStatus({ className, ...rest }) {
  const status = useSyncStatus()
  const peers = usePresence()
  // The show, not the room. The room is a digest of the key now -- twelve characters
  // of base64 that mean nothing to anybody -- and the name the studio already has is
  // the one an operator would have used anyway.
  const { studio } = useStudio()
  const show = studio?.name || 'this show'

  if (!status.configured && status.state === 'offline') return null

  const look = LOOKS[status.state] ?? LOOKS.offline
  const others = peers.filter((peer) => !peer.self)

  const detail =
    status.state === 'connected'
      ? others.length
        ? `${describe(others)} also on ${show}`
        : `Connected to ${show}. Nobody else is here.`
      : status.state === 'error'
        ? `Cannot reach the relay${status.detail ? `: ${status.detail}` : ''}. Your graphics are unaffected — edits will sync when it returns.`
        : status.state === 'connecting'
          ? `Reaching ${show}…`
          : 'Not connected. Edits stay on this machine.'

  return (
    <Tooltip label={detail} align="end" className={className}>
      <span className={cx('ss-sync-status flex items-center gap-1.5 rounded-md px-2 py-1 text-xs', look.text)} data-state={status.state} {...rest}>
        <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', look.dot)} />
        {look.label}
        {others.length ? <span className="ss-sync-peers text-slate-500">&middot; {others.length + 1}</span> : null}
      </span>
    </Tooltip>
  )
}

/** "Dez", "Dez and Sam", "Dez, Sam and 2 others" — a list an operator can read. */
function describe(peers) {
  const names = peers.map((peer) => peer.name).filter(Boolean)

  if (!names.length) return peers.length === 1 ? 'One other operator' : `${peers.length} other operators`
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`

  return `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length === 3 ? '' : 's'}`
}
