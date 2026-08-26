import { useEffect, useRef, useState } from 'react'

import { displayRelay, relayLink, resolveRelay, useRelay } from '../../hooks/useRelay'
import { newSecret } from '../../velcro/crypto'
import { usePresence, useSyncStatus } from '../../hooks/useSync'
import { cx } from '../../toolkits/cx'
import { Confirm } from './Confirm'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'
import { Operator } from './Operator'
import { RelayAdmin } from './RelayAdmin'
import { SyncStatus } from './SyncStatus'

/**
 * Bringing other people into the show, for somebody who has never heard of a relay.
 *
 * The whole feature has to be reachable without documentation, because the person
 * setting it up is a streamer half an hour before doors, not an engineer. So: one
 * quiet button when nothing is connected, and a form that says what to paste and
 * where to find it.
 *
 * **Pressing Go rewrites the page's URL.** A dock's URL is the only thing OBS
 * remembers; put the room in local storage alone and re-adding the dock -- or
 * moving to a second machine -- loses it silently. In the URL it is portable,
 * inspectable, and it is already the format an invite link uses, so the streamer's
 * own dock URL *is* an invite they can send.
 *
 * It no longer reloads, and that is a consequence rather than a decision: the whole
 * room moved into the fragment, and a navigation that changes only the fragment is
 * a same-document one. Which turns out to be better -- joining is a message to the
 * worker, not a restart, so there is no flash and no cold store -- but it does mean
 * the dialog has to close itself, where before the reload took it away.
 *
 * It never opens itself. A studio with one operator is the common case and works
 * with none of this; a modal demanding setup on first run would be asking most
 * people to dismiss something they will never need.
 */
/**
 * The connection light, and a shortcut to the settings behind it.
 *
 * Stays in the header rather than moving into the menu with everything else, and
 * that is deliberate: an operator has to be able to see at a glance whether their
 * edits are reaching anybody. On a board driving a live show that is the difference
 * between fixing a problem and not knowing there is one, and a state you have to
 * open a menu to read is a state nobody reads.
 *
 * Renders nothing at all until a studio has joined a room. A single-operator board
 * is the common case, works with none of this, and should not carry a light that
 * has nothing to report.
 */
export function Collaborate({ onOpen, className, ...rest }) {
  const status = useSyncStatus()

  if (!status.configured) return null

  // No Tooltip here: SyncStatus carries its own, naming the show and who is in it,
  // and wrapping it in a second one stacked two bubbles under the same button.
  // The button keeps an aria-label, which is what a screen reader needs and what a
  // tooltip is not.
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Collaboration settings"
      className={cx('ss-collaborate flex items-center rounded-md transition-colors hover:bg-slate-800', className)}
      {...rest}
    >
      <SyncStatus />
    </button>
  )
}

/**
 * Who else is in the room, by name.
 *
 * The count in the header answers "is anybody there"; this answers "who", which is
 * the question that comes next and the one an operator asks out loud. Cheap now
 * that every machine has a name to give -- a list of blanks would have been worse
 * than the number it replaced.
 */
function Roster() {
  const peers = usePresence()
  const others = peers.filter((peer) => !peer.self)

  if (!others.length) return <span className="ss-roster text-xs text-slate-600">Nobody else is here yet.</span>

  return (
    <ul className="ss-roster flex flex-wrap gap-1.5">
      {others.map((peer) => (
        <li key={peer.id} className="ss-roster-name flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-200">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
          {peer.name || 'Unnamed'}
        </li>
      ))}
    </ul>
  )
}

/** The settings themselves, opened from the menu. */
export function CollaborateDialog({ open, onClose }) {
  const status = useSyncStatus()
  const { config, join, leave, reference } = useRelay({ auto: false })

  return <SetupDialog open={open} onClose={onClose} config={config} join={join} leave={leave} reference={reference} offset={status.offset} />
}

/** "3s behind" / "12s ahead", from the offset that would correct it. */
const formatSkew = (offset) => `${Math.round(Math.abs(offset) / 1000)}s ${offset > 0 ? 'behind' : 'ahead of'}`

function SetupDialog({ open, onClose, config, join, leave, reference, offset }) {
  const dialog = useRef(null)
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [clock, setClock] = useState(false)
  const [secret, setSecret] = useState('')
  const [help, setHelp] = useState(false)
  const [copied, setCopied] = useState(false)

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

    setUrl(displayRelay(config?.url))
    setToken(config?.token ?? '')
    // Whoever is filling this in for the first time is the streamer at the machine
    // running OBS -- everybody else arrives on a link and never sees this form. So
    // the useful default is on, and the box exists for the case where it is wrong.
    setClock(config?.url ? reference : true)
    // A new room is sealed unless somebody says otherwise. The document holds guest
    // names, sponsor copy and scores before anybody is meant to see them, and on
    // this transport sealing costs nothing -- see the note by the box.
    setSecret(config?.url ? (config.secret ?? '') : newSecret())
  }, [open, config, reference])

  // A relay of your own holds the show so an operator can open their board before
  // you are up. That means it has to be able to read it. Supabase holds nothing, so
  // there is nothing to give up -- which is the whole reason this is offered here
  // and not there.
  // A project reference resolves to https, which is the sealed transport; a relay
  // of one's own is ws or wss, which is not. Resolve before asking.
  const canSeal = /^https?:/i.test(resolveRelay(url))

  const go = () => {
    // No room. The key is the room -- see `deriveRoom` -- and a show without one
    // lands on the studio's own name, which is what one-repo-per-show already means.
    const next = { url: resolveRelay(url), token: token.trim(), reference: clock, secret: canSeal ? secret : '' }

    if (!next.url) return

    join(next)

    // Into the URL. The dock URL becomes the whole configuration -- portable to
    // another machine, and already the shape of an invite link.
    window.location.replace(relayLink(next))
    onClose()
  }

  const invite = config?.url ? relayLink({ url: config.url, room: config.room, token: config.token, secret: config.secret }) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // A dock without clipboard permission leaves the link on screen to select by
      // hand, which is why the text is still there to select.
      setCopied(false)
    }
  }

  const disconnect = () => {
    leave()
    onClose()
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
            <span className="text-xs text-emerald-100/70">
              Send them this. Opening it is their whole setup &mdash; in a browser, or in an OBS dock if they are running one.
              {config.secret ? ' It contains the key to this show, so send it the way you would send a password.' : null}
            </span>
            {/* Selectable *and* copyable. Selecting eighty characters of base64 in a
                dock the width of a sidebar is a drag somebody gets wrong twice; the
                button is how this is actually used. The text stays because a link
                you cannot see is a link you cannot check. */}
            <div className="flex items-start gap-2">
              <code className="ss-invite-link min-w-0 grow select-all break-all rounded bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100">{invite}</code>
              <button
                type="button"
                onClick={copy}
                className="ss-invite-copy shrink-0 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200 transition-colors hover:border-emerald-400 hover:text-emerald-100"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </section>
        ) : null}

        {config?.url && secret && secret !== (config.secret ?? '') ? (
          <p className="ss-rekey-warning rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            Press <span className="font-medium">Move</span> to start this show over with a new key. Your show comes with you. Everyone you still want in it
            needs the new link &mdash; anyone holding the old one is left behind, which is the point.
          </p>
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
          <ol className="ss-collaborate-help flex list-decimal flex-col gap-1.5 rounded-md border border-slate-800 bg-slate-950/60 p-3 pl-7 text-xs text-slate-400">
            <li>
              Sign in at{' '}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer noopener"
                className="ss-supabase-link font-mono text-sky-400 underline-offset-2 hover:underline"
              >
                supabase.com
              </a>{' '}
              &mdash; GitHub, Google or email. The free tier is enough and it does not ask for a card.
            </li>
            <li>
              Make an <span className="text-slate-300">organisation</span> if it asks for one. It is a container for projects; the name does not matter and you
              can be its only member.
            </li>
            <li>
              Then <span className="text-slate-300">New project</span>. Any name, any region near you, any database password &mdash; you will not need the
              password.
            </li>
            <li>Wait a minute or two while it builds.</li>
            <li>
              Open <span className="text-slate-300">Project Settings</span> from the sidebar. The <span className="text-slate-300">Project ID</span> on that
              page is the first box below &mdash; a short string of letters, not a web address.
            </li>
            <li>
              Then <span className="text-slate-300">API Keys</span>, and copy the <span className="text-slate-300">publishable</span> key (it starts{' '}
              <span className="font-mono text-slate-300">sb_publishable_</span>) into the second box. An older project may show{' '}
              <span className="font-mono text-slate-300">anon</span> under a <span className="text-slate-300">Legacy</span> tab instead; that works too.
            </li>
            <li>Nothing else. No tables, no policies, no code.</li>
          </ol>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Project ID</span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="abcdefghijklmnopqrst"
            aria-label="Project ID"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-sky-500"
          />
          <span className="text-xs text-slate-600">
            From Project Settings. A full <span className="font-mono">https://…supabase.co</span> address works too, as does your own relay&rsquo;s{' '}
            <span className="font-mono">wss://</span> address.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Publishable key</span>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="sb_publishable_…"
            aria-label="Publishable key"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-sky-500"
          />
          <span className="text-xs text-slate-600">
            Safe to share &mdash; it is meant to sit in a public page. A legacy <span className="font-mono">anon</span> key works as well.
          </span>
        </label>

        {/* Who you are, beside who else is here. It used to be a panel on the board,
            which put a field you touch once next to the ones you touch every
            minute -- and put it nowhere near the only screen that explains what it
            is for. */}
        <div className="ss-collaborate-you flex flex-col gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <Operator label="You are" placeholder="Your name" />
          <span className="text-xs text-slate-600">Shown to the other operators, and beside any field you have open. Only ever stored on this machine.</span>
          <Roster />
          {/* Only for a relay of your own: a hosted project has no token API. */}
          <RelayAdmin />
        </div>

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

        {/* Two sentences, because the trade is real either way and the person reading
            it is deciding for a whole production. Encryption is free on Supabase and
            costs the late-joiner guarantee on a relay, and that is the sort of thing
            somebody should be told where the choice is, not in a document. */}
        <label
          className={cx(
            'ss-seal flex items-start gap-2.5 rounded-md border p-3',
            canSeal ? 'cursor-pointer border-slate-800 bg-slate-950/60' : 'border-slate-800/60 bg-slate-950/30',
          )}
        >
          <input
            type="checkbox"
            checked={Boolean(secret) && canSeal}
            disabled={!canSeal}
            onChange={(event) => setSecret(event.target.checked ? secret || newSecret() : '')}
            aria-label="Encrypt this show"
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-sky-500 disabled:cursor-not-allowed"
          />
          <span className="flex flex-col gap-0.5">
            <span className={cx('text-sm', canSeal ? 'text-slate-200' : 'text-slate-500')}>Encrypt this show</span>
            <span className="text-xs text-slate-500">
              {canSeal
                ? 'Supabase carries your show without being able to read it, and the key is also the address — there is no room name for anyone to guess. The invite link becomes the key, so send it like a password. Turn this off and the show sits under this studio’s name, in the open, for anyone on this project.'
                : 'Not available on your own relay: it keeps a copy of the show so operators can open their boards before you are up, which means it has to be able to read it. Your relay’s tokens are what keep people out there.'}
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
        {/* It said "Work alone", which is what it leaves you doing rather than what
            it does, and nobody looking for a way out of a room recognised it. The
            word people go looking for is the one they were told when they joined. */}
        {config?.url ? (
          <Confirm
            onConfirm={disconnect}
            label="Disconnect"
            tone="quiet"
            className="ss-disconnect px-2 py-1 text-xs"
            title="Leave the room and drive this show from this machine alone. Your graphics keep working; nothing is deleted."
          />
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
