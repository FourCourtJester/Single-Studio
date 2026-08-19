import { useEffect, useRef, useState } from 'react'

import { relayLink, useRelay } from '../../hooks/useRelay'
import { useSyncStatus } from '../../hooks/useSync'
import { cx } from '../../toolkits/cx'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'
import { SyncStatus } from './SyncStatus'

/**
 * Bringing other people into the show, for somebody who has never heard of a relay.
 *
 * The whole feature has to be reachable without documentation, because the person
 * setting it up is a streamer half an hour before doors, not an engineer. So: one
 * quiet button when nothing is connected, and a form that says what to paste and
 * where to find it.
 *
 * **Pressing Go rewrites the page's URL and reloads.** That looks heavy-handed and
 * is the most useful thing here. A dock's URL is the only thing OBS remembers; put
 * the room in local storage alone and re-adding the dock -- or moving to a second
 * machine -- loses it silently. In the URL it is portable, inspectable, and it is
 * already the format an invite link uses, so the streamer's own dock URL *is* an
 * invite they can send.
 *
 * It never opens itself. A studio with one operator is the common case and works
 * with none of this; a modal demanding setup on first run would be asking most
 * people to dismiss something they will never need.
 */
export function Collaborate({ className, ...rest }) {
  const status = useSyncStatus()
  const { config, join, reference } = useRelay({ auto: false })
  const [open, setOpen] = useState(false)

  return (
    <span className={cx('ss-collaborate flex items-center gap-2', className)} {...rest}>
      {status.configured ? (
        <button type="button" onClick={() => setOpen(true)} aria-label="Collaboration settings" className="rounded-md transition-colors hover:bg-slate-800">
          <SyncStatus />
        </button>
      ) : (
        <Tooltip label="Bring other operators into this show" align="end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ss-collaborate-open flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
          >
            <Icon name="people" className="h-3.5 w-3.5" />
            Collaborate
          </button>
        </Tooltip>
      )}

      <SetupDialog open={open} onClose={() => setOpen(false)} config={config} join={join} room={status.room} reference={reference} offset={status.offset} />
    </span>
  )
}

/** "3s behind" / "12s ahead", from the offset that would correct it. */
const formatSkew = (offset) => `${Math.round(Math.abs(offset) / 1000)}s ${offset > 0 ? 'behind' : 'ahead of'}`

function SetupDialog({ open, onClose, config, join, room, reference, offset }) {
  const dialog = useRef(null)
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [clock, setClock] = useState(false)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    const element = dialog.current

    if (!element) return

    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  // Filled from whatever is already known each time it opens, rather than once at
  // mount: a board that joined on a link should show that, not an empty form.
  useEffect(() => {
    if (!open) return

    setUrl(config?.url ?? '')
    setToken(config?.token ?? '')
    setName(config?.room ?? room ?? '')
    // Whoever is filling this in for the first time is the streamer at the machine
    // running OBS -- everybody else arrives on a link and never sees this form. So
    // the useful default is on, and the box exists for the case where it is wrong.
    setClock(config?.url ? reference : true)
  }, [open, config, room, reference])

  const go = () => {
    const next = { url: url.trim(), room: name.trim(), token: token.trim(), reference: clock }

    if (!next.url) return

    join(next)

    // Into the URL, then reload. The dock URL becomes the whole configuration --
    // portable to another machine, and already the shape of an invite link.
    window.location.replace(relayLink(next))
  }

  const leave = () => {
    join({ reference: false })
    window.location.replace(relayLink({}))
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onCancel={onClose}
      className="ss-collaborate-dialog m-auto w-[min(34rem,92vw)] rounded-lg border border-slate-800 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/60 open:flex open:flex-col"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Collaborate</h2>
        <Tooltip label="Close" align="end" className="ml-auto">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            <Icon name="close" />
          </button>
        </Tooltip>
      </header>

      <div className="flex flex-col gap-3 overflow-y-auto p-4">
        {config?.url ? (
          <section className="flex flex-col gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
            <span className="text-xs font-medium uppercase tracking-wide text-emerald-200">Invite someone</span>
            <span className="text-xs text-emerald-100/70">Send them this. They paste it into an OBS custom browser dock, and that is their whole setup.</span>
            <code className="ss-invite-link select-all break-all rounded bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100">
              {relayLink({ url: config.url, room: config.room, token: config.token })}
            </code>
          </section>
        ) : null}

        <p className="text-sm text-slate-400">
          Other people can drive this show from their own machines. Their edits appear here, yours appear on theirs, and your graphics keep working even if the
          connection does not.
        </p>

        <p className="text-xs text-slate-500">
          You need a free Supabase project. We never see it, and there is nothing to install &mdash; it is two values to copy.{' '}
          <button type="button" onClick={() => setHelp((was) => !was)} className="text-sky-400 underline-offset-2 hover:underline">
            {help ? 'Hide the steps' : 'Show me how'}
          </button>
        </p>

        {help ? (
          <ol className="ss-collaborate-help flex list-decimal flex-col gap-1 rounded-md border border-slate-800 bg-slate-950/60 p-3 pl-7 text-xs text-slate-400">
            <li>
              Go to <span className="font-mono text-slate-300">supabase.com</span> and sign in. The free tier is enough, and it does not ask for a card.
            </li>
            <li>
              Press <span className="text-slate-300">New project</span>. Any name, any region near you, any database password &mdash; you will not need it.
            </li>
            <li>Wait a minute or two while it builds.</li>
            <li>
              Open <span className="text-slate-300">Project Settings &rarr; API</span>.
            </li>
            <li>
              Copy the <span className="text-slate-300">Project URL</span> and the key labelled <span className="font-mono text-slate-300">anon</span>{' '}
              <span className="font-mono text-slate-300">public</span> into the boxes below.
            </li>
            <li>Nothing else. No tables, no settings, no code.</li>
          </ol>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Project URL</span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://abcdefgh.supabase.co"
            aria-label="Project URL"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Anon key</span>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="eyJhbGciOi…"
            aria-label="Anon key"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-sky-500"
          />
          <span className="text-xs text-slate-600">Safe to share &mdash; it is a public key. What keeps a show private is the room name.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Room</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="friday-night"
            aria-label="Room name"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500"
          />
          <span className="text-xs text-slate-600">Anything, as long as everyone on the show uses the same one. Make it hard to guess.</span>
        </label>

        {/* Skew between two machines is routinely seconds, and it is invisible: every
            screen shows a five-minute break as five minutes while the one going to
            air runs long. Naming one machine fixes it, and the machine to name is
            always the one nobody is guessing about. */}
        <label className="ss-clock-role flex cursor-pointer items-start gap-2.5 rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <input
            type="checkbox"
            checked={clock}
            onChange={(event) => setClock(event.target.checked)}
            aria-label="This machine runs OBS"
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-sky-500"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm text-slate-200">This machine runs OBS</span>
            <span className="text-xs text-slate-500">
              Everyone&rsquo;s timers follow this machine&rsquo;s clock, so a five-minute break is five minutes on air even if somebody else&rsquo;s computer
              disagrees about the time. Tick it on one machine only.
            </span>
          </span>
        </label>

        {!clock && Math.abs(offset ?? 0) >= 1000 ? (
          <p className="ss-clock-offset text-xs text-amber-400">
            This computer&rsquo;s clock is {formatSkew(offset)} the one running OBS. Timers are corrected for it &mdash; the numbers here are what goes to air.
          </p>
        ) : null}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-slate-800 px-4 py-3">
        {config?.url ? (
          <button type="button" onClick={leave} className="text-xs text-slate-500 transition-colors hover:text-rose-400">
            Work alone
          </button>
        ) : null}
        <button
          type="button"
          onClick={go}
          disabled={!url.trim()}
          className="ss-collaborate-go ml-auto rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-40"
        >
          {config?.url ? 'Move' : 'Go'}
        </button>
      </footer>
    </dialog>
  )
}
