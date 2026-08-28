import { useEffect, useRef, useState } from 'react'

import { usePlugins } from '../../hooks/usePlugins'
import { cx } from '../../toolkits/cx'
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

/** One plugin: what it is, whether it is talking, and what it can be asked. */
function Entry({ plugin, onSave }) {
  const [draft, setDraft] = useState(plugin.values ?? {})
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState(null)

  // The manifest is re-read after every save, so the row has to follow it rather
  // than keep editing a copy from before the restart.
  useEffect(() => setDraft(plugin.values ?? {}), [plugin.values])

  const dirty = Object.keys(draft).some((key) => draft[key] !== plugin.values?.[key])
  const status = plugin.status ?? 'idle'

  const save = async () => {
    setSaving(true)
    setProblem(null)

    const result = await onSave(plugin.name, draft)

    setSaving(false)
    if (!result?.ok) setProblem(result?.reason ?? 'It would not restart with those settings.')
  }

  return (
    <section className={cx('ss-plugin flex flex-col gap-1 border-t border-slate-800 py-3 first:border-t-0')} data-plugin={plugin.name} data-status={status}>
      <header className="flex items-center gap-2">
        <span className={cx('h-2 w-2 shrink-0 rounded-full', TONE[status] ?? TONE.idle)} aria-hidden="true" />
        <h3 className="grow text-sm font-medium text-slate-100">{plugin.label ?? plugin.name}</h3>
        <span className="text-xs text-slate-500">{SAYS[status] ?? status}</span>
      </header>

      {plugin.summary ? <p className="ss-plugin-summary -mt-0.5 text-xs text-slate-500">{plugin.summary}</p> : null}

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

      <Help blocks={plugin.help} plugin={plugin.name} />

      {plugin.config?.length ? (
        <>
          <div className="flex flex-col">
            {plugin.config.map((field) => (
              <Field key={field.key} field={field} value={draft[field.key]} onChange={(next) => setDraft((was) => ({ ...was, [field.key]: next }))} />
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
      ) : (
        <p className="text-xs text-slate-500">Nothing to configure.</p>
      )}
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
  const { plugins, loading, configure } = usePlugins()

  return (
    <div className={cx('ss-plugins flex flex-col', className)} {...rest}>
      {loading ? (
        <p className="py-2 text-sm text-slate-500">Asking the worker…</p>
      ) : plugins.length ? (
        <>
          {plugins.map((plugin) => (
            <Entry key={plugin.name} plugin={plugin} onSave={configure} />
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
