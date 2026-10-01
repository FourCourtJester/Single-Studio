import { useEffect, useRef, useState } from 'react'

import { usePlugins } from '../../hooks/usePlugins'
import { cx } from '../../toolkits/cx'
import { gatedBetween, localPermission, promptable } from '../../toolkits/network'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'

const TONE = {
  connected: 'bg-emerald-500',
  reconnecting: 'bg-amber-500',
  error: 'bg-rose-500',
  delegated: 'bg-sky-500',
  idle: 'bg-slate-600',
}

const SAYS = {
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  error: 'Not connecting',
  delegated: 'Another machine is running this',
  idle: 'Not started',
}

/** One field, rendered by its declared type. */
function Field({ field, value, onChange }) {
  const id = `ss-plugin-field-${field.key}`

  if (field.type === 'boolean') {
    return (
      <label htmlFor={id} className="flex items-center gap-2.5 py-1.5 text-sm text-slate-200">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-slate-800"
        />
        {field.label ?? field.key}
      </label>
    )
  }

  return (
    <label htmlFor={id} className="flex flex-col gap-1 py-1.5">
      <span className="text-sm text-slate-200">{field.label ?? field.key}</span>
      <input
        id={id}
        // `secret` is a password field and nothing more. It is not encrypted and it
        // is not hidden from anything that can read the settings database -- it
        // stops a key being read over a shoulder while a board is on a projector,
        // which is the threat an operator actually has.
        type={field.type === 'number' ? 'number' : field.type === 'secret' ? 'password' : 'text'}
        value={value ?? ''}
        placeholder={field.placeholder ?? ''}
        onChange={(event) => onChange(field.type === 'number' ? event.target.valueAsNumber : event.target.value)}
        className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600"
      />
      {field.help ? <span className="text-xs text-slate-500">{field.help}</span> : null}
    </label>
  )
}

/**
 * One block of a plugin's help.
 *
 * Rendered as elements, never as HTML. The content came across `postMessage` from
 * a dependency a studio installed, and a markdown string would mean a parser and
 * `dangerouslySetInnerHTML` -- which is a way of letting a package put arbitrary
 * markup on an operator's board. Here the worst it can do is write dull text.
 */
function Block({ block }) {
  if (block.type === 'steps') {
    return (
      <ol className="ss-help-steps ml-4 list-decimal space-y-1 text-xs text-slate-400 marker:text-slate-600">
        {(block.items ?? []).map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ol>
    )
  }

  if (block.type === 'code') {
    return <pre className="ss-help-code overflow-x-auto rounded bg-slate-950 px-2.5 py-2 font-mono text-[11px] text-slate-300">{block.text}</pre>
  }

  if (block.type === 'link') {
    return (
      <a
        href={block.href}
        target="_blank"
        // `noreferrer` as well as `noopener`: the target is a URL a plugin chose,
        // and there is no reason it should learn where the operator came from.
        rel="noopener noreferrer"
        className="ss-help-link text-xs text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:decoration-sky-400"
      >
        {block.label || block.href}
      </a>
    )
  }

  if (block.type === 'note') {
    return <p className="ss-help-note rounded border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-200/90">{block.text}</p>
  }

  return <p className="ss-help-text text-xs text-slate-400">{block.text}</p>
}

/**
 * Something a plugin needs the operator to read or do, kept current while the
 * panel is open.
 *
 * A code is set large and selectable because it is going to be read off this
 * screen and typed on a phone, possibly across a room.
 */
function Notice({ notice }) {
  return (
    <div role="status" className="ss-plugin-notice flex flex-col gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2">
      <p className="ss-plugin-notice-text text-xs text-sky-100">{notice.text}</p>
      {notice.code ? <p className="ss-plugin-code select-all font-mono text-2xl font-semibold tracking-[0.2em] text-white">{notice.code}</p> : null}
      {notice.href ? (
        <a
          href={notice.href}
          target="_blank"
          rel="noopener noreferrer"
          className="ss-plugin-notice-link self-start text-xs text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:decoration-sky-400"
        >
          {notice.label || notice.href}
        </a>
      ) : null}
    </div>
  )
}

/**
 * Whether the browser will let this studio reach `kind` of address, kept current.
 *
 * `null` means the browser does not gate it, or nothing here is gated -- nothing to
 * say. Watched rather than read once: the answer changes the moment somebody
 * accepts the prompt, or allows the site by hand in another tab.
 *
 * @param {'loopback' | 'local' | null} kind
 */
function useLocalAccess(kind) {
  const [state, setState] = useState(null)
  const [asked, setAsked] = useState(0)

  useEffect(() => {
    if (!kind) {
      setState(null)

      return undefined
    }

    let live = true
    let status = null
    const follow = () => live && setState(status?.state ?? null)

    localPermission(kind).then((found) => {
      status = found
      follow()
      status?.addEventListener?.('change', follow)
    })

    return () => {
      live = false
      status?.removeEventListener?.('change', follow)
    }
  }, [kind, asked])

  return { state, recheck: () => setAsked((count) => count + 1) }
}

/**
 * Why a plugin on this computer cannot connect, when the reason is the browser.
 *
 * The reason under the light says "Could not reach rocket-league at
 * ws://localhost:49124", which sends an operator to the game -- and the game is
 * running. Chrome is refusing the connection without saying so: a WebSocket never
 * shows the prompt, and the plugin's socket is in a worker, which cannot ask. A
 * plain request from this page does bring the prompt up, so that is what Allow
 * makes; the permission belongs to the studio's site, and the worker's socket gets
 * through from then on. Both halves checked in Chrome 154.
 *
 * Worded without Chrome's label for the setting, which has changed twice in a year;
 * the label is offered once, as where to look today.
 */
function LocalAccess({ kind, state, asking, onAllow }) {
  const where = kind === 'loopback' ? 'programs on this computer' : 'devices on your network'

  return (
    <div role="status" className="ss-local-access flex flex-col gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2" data-state={state}>
      <p className="text-xs text-amber-100">This browser is blocking the studio from reaching {where}, so this plugin cannot connect however it is set up.</p>
      {state === 'denied' ? (
        <p className="text-xs text-amber-200/80">
          It was refused before, so the browser will not ask again. Allow this site in its settings (the icon left of the address bar; Chrome 154 calls it “App
          devices”), then reload.
        </p>
      ) : (
        <>
          <p className="text-xs text-amber-200/80">Press Allow and accept the browser’s prompt. Once per computer.</p>
          <button
            type="button"
            disabled={asking}
            onClick={onAllow}
            className="ss-local-access-allow self-start rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-50 transition-colors hover:border-amber-400 disabled:opacity-50"
          >
            {asking ? 'Waiting for the browser…' : 'Allow'}
          </button>
        </>
      )}
    </div>
  )
}

/** Setup instructions, written by whoever knows, shown where the question is asked. */
function Help({ blocks, plugin }) {
  const [open, setOpen] = useState(false)

  if (!blocks?.length) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls={`ss-help-${plugin}`}
        className="ss-help-toggle self-start text-xs text-slate-500 underline decoration-slate-700 underline-offset-2 transition-colors hover:text-slate-300"
      >
        {open ? 'Hide setup' : 'How do I set this up?'}
      </button>

      {open ? (
        <div id={`ss-help-${plugin}`} className="ss-help mt-1 flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-950/50 p-3">
          {blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </div>
      ) : null}
    </>
  )
}

/**
 * One plugin: what it is, whether it is talking, and what it can be asked.
 *
 * Folded away *if it is connected*, because a studio with six plugins is a scroll
 * and the thing an operator does most often with this panel is read it, not edit
 * it. What stays out is what answers "is everything up": the light, the name, the
 * status word, and the reason when there is one.
 *
 * Anything not connected opens itself. That is the row somebody came here for --
 * the settings that need changing are the ones behind a plugin that is not talking
 * -- and it means the common case of opening this panel *because* something is
 * wrong needs no clicks at all. A panel where everything is fine is a short list;
 * a panel where one thing is broken opens on the broken one.
 *
 * Decided once, when the panel mounts, which is when the dialog opens: the whole
 * panel is unmounted while the modal is closed. Deliberately not tracked
 * afterwards, or a row would slam shut under an operator the moment their fix
 * connected -- while they were still reading it.
 *
 * The reason deliberately does not fold either. A plugin that cannot reach its game
 * is the one row somebody needs to read, and hiding the sentence behind a click
 * would put the panel back to saying "Not connecting" with no more to offer --
 * which is the state this whole panel exists to get away from.
 */
function Entry({ plugin, onSave, onAct }) {
  const [open, setOpen] = useState(() => (plugin.status ?? 'idle') !== 'connected')
  const [draft, setDraft] = useState(plugin.values ?? {})
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(null)
  const [problem, setProblem] = useState(null)
  // The fields the operator has typed in since the last save.
  const touched = useRef(new Set())

  // The manifest is re-read every second while the panel is open, and after every
  // save, so the row has to follow it -- a plugin that just signed in has new
  // values. But only for fields nobody is typing in: following blindly replaced an
  // operator's half-typed port with the stored one, once a second. Keyed on the
  // content rather than the object, because every read is a new object.
  const stored = JSON.stringify(plugin.values ?? {})

  useEffect(() => {
    const values = JSON.parse(stored)

    setDraft((was) => {
      const next = { ...values }

      for (const key of touched.current) next[key] = was[key]

      return next
    })
  }, [stored])

  const dirty = Object.keys(draft).some((key) => draft[key] !== plugin.values?.[key])
  const status = plugin.status ?? 'idle'

  // Only a step inwards from where this page is served is gated: a studio on GitHub
  // Pages reaching localhost, not the dev server reaching it.
  const gated = plugin.address ? gatedBetween(window.location.href, plugin.address) : null
  const access = useLocalAccess(status === 'connected' ? null : gated)
  const [asking, setAsking] = useState(false)
  const blocked = access.state === 'prompt' || access.state === 'denied'

  const allow = async () => {
    setAsking(true)

    try {
      // Answered or not, this is only here for the prompt. A port speaking WebSocket
      // rejects a plain request, after the permission has been settled.
      await fetch(promptable(plugin.address), { mode: 'no-cors', cache: 'no-store' })
    } catch {
      // Expected either way.
    }

    const now = await localPermission(gated)

    setAsking(false)
    access.recheck()

    // Now rather than at its next retry, which can be seconds away.
    if (now?.state === 'granted') await onSave(plugin.name, plugin.values ?? {})
  }

  const save = async () => {
    setSaving(true)
    setProblem(null)

    const result = await onSave(plugin.name, draft)

    setSaving(false)
    if (!result?.ok) setProblem(result?.reason ?? 'It would not restart with those settings.')
    else touched.current.clear()
  }

  const act = async (key) => {
    setActing(key)
    setProblem(null)

    const result = await onAct(plugin.name, key)

    setActing(null)
    if (!result?.ok) setProblem(result?.reason ?? 'That did not work.')
  }

  return (
    <section
      className={cx('ss-plugin flex flex-col gap-1 border-t border-slate-800 py-3 first:border-t-0')}
      data-plugin={plugin.name}
      data-status={status}
      data-open={open ? '' : undefined}
    >
      <h3>
        <button
          type="button"
          onClick={() =>
            setOpen((was) => {
              // Folding away drops the save's own message, so the plugin's standing
              // reason -- the same sentence, suppressed while the local one showed --
              // takes back over. Without this, collapsing a row that had just refused
              // a config hides both and the row goes quiet about a real problem.
              if (was) setProblem(null)

              return !was
            })
          }
          aria-expanded={open}
          aria-controls={`ss-plugin-body-${plugin.name}`}
          className="ss-plugin-toggle flex w-full items-center gap-2 text-left"
        >
          <span className="grow text-sm font-medium text-slate-100">{plugin.label ?? plugin.name}</span>
          <span className="text-xs text-slate-500">{SAYS[status] ?? status}</span>
          {/*
            The light ends the row, where a disclosure triangle used to. The triangle
            was a play button as far as anyone reading it was concerned -- a ▶
            beside a plugin that is not running invites a click meaning "start it",
            which is not what it did. Nothing here starts a plugin; the worker does
            that. So the glyph is gone and the light has its place.

            Losing it costs the row its open/closed glyph. The fields appearing is
            the cue now, `aria-expanded` still says it for a screen reader, and
            `data-open` still says it for CSS.
          */}
          <span className={cx('ss-plugin-light h-2 w-2 shrink-0 rounded-full', TONE[status] ?? TONE.idle)} aria-hidden="true" />
        </button>
      </h3>

      {/*
        Why, not just that. A red light saying "Not connecting" sends an operator
        to whoever built the studio; "Could not reach rocket-league at
        ws://127.0.0.1:49122" sends them to the game, which is where the fix is.
        Reported by the plugin itself, so it clears when the plugin recovers.

        Not while a save is being reported, though. The manifest is read back after
        every save, so a rejected one arrives here as well as beside the button --
        the same sentence twice, once where it was asked for and once where it was
        not. The one by the button wins: it is next to what they just pressed.
      */}
      {plugin.problem && !problem ? (
        <p role="status" className="ss-plugin-reason text-xs text-rose-400">
          {plugin.problem}
        </p>
      ) : null}

      {/*
        What the plugin is waiting on the operator for. Outside the fold for the
        same reason the reason is: a code to type on another device is the one thing
        on this row that matters, and it changes while they are away typing it.
      */}
      {plugin.notice ? <Notice notice={plugin.notice} /> : null}

      {blocked ? <LocalAccess kind={gated} state={access.state} asking={asking} onAllow={allow} /> : null}

      {open ? (
        <div id={`ss-plugin-body-${plugin.name}`} className="ss-plugin-body flex flex-col gap-1">
          {plugin.summary ? <p className="ss-plugin-summary -mt-0.5 text-xs text-slate-500">{plugin.summary}</p> : null}

          <Help blocks={plugin.help} plugin={plugin.name} />

          {plugin.actions?.length ? (
            <div className="ss-plugin-actions flex flex-wrap items-center gap-2 py-1.5">
              {plugin.actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  data-action={action.key}
                  disabled={Boolean(acting)}
                  onClick={() => act(action.key)}
                  className="ss-plugin-action rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 transition-colors hover:border-slate-400 disabled:opacity-50"
                >
                  {acting === action.key ? 'Working…' : action.label}
                </button>
              ))}
            </div>
          ) : null}

          {plugin.config?.length ? (
            <>
              <div className="flex flex-col">
                {plugin.config.map((field) => (
                  <Field
                    key={field.key}
                    field={field}
                    value={draft[field.key]}
                    onChange={(next) => {
                      touched.current.add(field.key)
                      setDraft((was) => ({ ...was, [field.key]: next }))
                    }}
                  />
                ))}
              </div>

              <div className="mt-1 flex items-center gap-3">
                <button
                  type="button"
                  disabled={!dirty || saving}
                  onClick={save}
                  className={cx(
                    'ss-plugin-save rounded-md px-3 py-1.5 text-xs transition-colors',
                    dirty && !saving ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' : 'cursor-default border border-slate-800 text-slate-600',
                  )}
                >
                  {saving ? 'Reconnecting…' : 'Save and reconnect'}
                </button>
                {problem ? (
                  <p role="alert" className="ss-plugin-problem text-xs text-rose-400">
                    {problem}
                  </p>
                ) : null}
              </div>
            </>
          ) : plugin.actions?.length ? (
            problem ? (
              <p role="alert" className="ss-plugin-problem text-xs text-rose-400">
                {problem}
              </p>
            ) : null
          ) : (
            <p className="text-xs text-slate-500">Nothing to configure.</p>
          )}
        </div>
      ) : null}
    </section>
  )
}

/**
 * Per-machine settings for whatever plugins a studio installed.
 *
 * A plugin's config belongs to the computer, not to the build. The port a game
 * listens on was chosen by whoever runs the game, in a file on their own PC, and a
 * studio author three time zones away cannot know it — baking it into the worker
 * entry would mean a rebuild and a redeploy to change somebody else's number.
 *
 * Saving restarts that plugin against the new values, because a plugin's config is
 * mostly the address of the thing it talks to and there is no useful version of
 * "change the port without reconnecting".
 */
export function Plugins({ className, ...rest }) {
  const { plugins, loading, configure, act } = usePlugins()

  return (
    <div className={cx('ss-plugins flex flex-col', className)} {...rest}>
      {loading ? (
        <p className="py-2 text-sm text-slate-500">Asking the worker…</p>
      ) : plugins.length ? (
        <>
          {plugins.map((plugin) => (
            <Entry key={plugin.name} plugin={plugin} onSave={configure} onAct={act} />
          ))}
          {/*
            Ruled off. It is a note about the whole panel sitting under the last
            plugin's fields, and without a line it reads as one more thing that
            plugin has to say.
          */}
          <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-500">
            These are stored with the studio on this machine, not in the show. Another operator&rsquo;s settings are their own.
          </p>
        </>
      ) : (
        <p className="py-2 text-sm text-slate-500">
          No plugins installed. A studio adds one by importing it into <code className="text-slate-400">src/velcro.worker.js</code>.
        </p>
      )}
    </div>
  )
}

/** The same panel as a modal, for the menu. */
export function PluginsDialog({ open, onClose }) {
  const dialog = useRef(null)

  useEffect(() => {
    const element = dialog.current

    if (!element) return

    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onCancel={onClose}
      className="ss-plugins-dialog m-auto max-h-[86vh] w-[min(34rem,94vw)] rounded-lg border border-slate-800 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/60 open:flex open:flex-col"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Plugins</h2>
        <Tooltip label="Close" align="end" className="ml-auto">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close plugin settings"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            <Icon name="close" />
          </button>
        </Tooltip>
      </header>
      <div className="min-h-0 grow overflow-y-auto p-4">{open ? <Plugins /> : null}</div>
    </dialog>
  )
}
