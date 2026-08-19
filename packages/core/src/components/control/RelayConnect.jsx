import { useState } from 'react'

import { useRelay } from '../../hooks/useRelay'
import { useSyncStatus } from '../../hooks/useSync'
import { cx } from '../../toolkits/cx'

/**
 * Point this machine at a relay.
 *
 * For the one person who has no invite link to arrive on: whoever runs the show.
 * Everybody else gets a URL and never sees this -- which is why it hides itself
 * once a room is joined rather than sitting on the board asking to be reconfigured
 * mid-broadcast.
 *
 * Runtime, not build time, and that is the point. A studio deploys as static files
 * to GitHub Pages; a relay address baked into the build is one that cannot be
 * changed without a rebuild and a redeploy, which is a poor thing to discover an
 * hour before doors. Kept in localStorage, so it is set once per machine.
 */
export function RelayConnect({ label = 'Relay', placeholder = 'https://your-project.supabase.co', className, ...rest }) {
  // Read-only until somebody presses Join: StudioApp owns the automatic case.
  const { config, join } = useRelay({ auto: false })
  const status = useSyncStatus()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(config?.url ?? '')
  const [room, setRoom] = useState(config?.room ?? '')
  const [token, setToken] = useState(config?.token ?? '')

  const joined = Boolean(config?.url)

  if (joined && !open) {
    return (
      <section className={cx('ss-relay-connect flex flex-col gap-1', className)} {...rest}>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className="min-w-0 grow truncate text-sm text-slate-300" title={config.url}>
            {status.room ?? config.room ?? 'connected'}
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-slate-500"
          >
            Change
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className={cx('ss-relay-connect flex flex-col gap-1', className)} {...rest}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-xs text-slate-500">
        Where the other operators connect. Set once on the machine running the show &mdash; a Supabase project URL, or your own relay.
      </span>
      <input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder={placeholder}
        aria-label="Relay address"
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500"
      />
      {/* Only a hosted service needs one, and a relay of your own does not, so it
          asks rather than insisting. */}
      <input
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="anon key (Supabase only)"
        aria-label="Project key"
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-sky-500"
      />
      <div className="ss-input-group flex">
        <input
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          placeholder="room name (optional)"
          aria-label="Room name"
          className="min-w-0 grow rounded-l-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:relative focus:border-sky-500"
        />
        <button
          type="button"
          onClick={() => {
            join({ url: url.trim(), room: room.trim(), token: token.trim() })
            setOpen(false)
          }}
          className="-ml-px shrink-0 rounded-r-md border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-sky-500 hover:bg-sky-500"
        >
          {joined ? 'Move' : 'Join'}
        </button>
      </div>
      {joined ? (
        <button
          type="button"
          onClick={() => {
            join(null)
            setOpen(false)
          }}
          className="self-start text-xs text-slate-500 transition-colors hover:text-rose-400"
        >
          Work alone instead
        </button>
      ) : null}
    </section>
  )
}
