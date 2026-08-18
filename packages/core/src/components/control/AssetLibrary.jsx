import { useEffect, useRef, useState } from 'react'

import { useAssetLibrary, useAssetUrl } from '../../hooks/useAssets'
import { toAssetRef } from '../../velcro/assets'
import { cx } from '../../toolkits/cx'
import { Icon } from '../common/Icon'

/**
 * Manage the studio's images: add, name, preview, remove.
 *
 * Two ways in, because images arrive two ways. A file gets dropped or chosen; a URL
 * gets pasted. Both become a named entry, so a graphic points at "ada-okafor"
 * rather than a hash or a link -- which is the name an operator recognises under
 * pressure, and means repointing a slot is a rename here rather than an edit
 * everywhere it is used.
 *
 * Rendered inline as a panel, or inside AssetLibraryDialog as a modal. `onPick`
 * turns it into a chooser.
 */
export function AssetLibrary({ onPick, selected, className, ...rest }) {
  const { assets, addFile, addUrl, remove, rename } = useAssetLibrary()
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [over, setOver] = useState(false)
  const input = useRef(null)

  const run = async (work) => {
    setBusy(true)
    setError(null)

    try {
      return await work()
    } catch (err) {
      setError(err?.message ?? 'that did not work')
      return null
    } finally {
      setBusy(false)
    }
  }

  const takeFiles = async (files) => {
    const chosen = [...(files ?? [])].filter((file) => file.type.startsWith('image/'))

    if (!chosen.length) {
      setError('that is not an image')
      return
    }

    // A key typed alongside a multi-file drop would collide, so it only applies to
    // a single file; the rest are named from their filenames.
    const entries = await run(() =>
      Promise.all(chosen.map((file) => addFile(file, { key: chosen.length === 1 ? key || undefined : undefined, name: file.name }))),
    )

    if (entries?.length === 1 && onPick) onPick(entries[0])
    setKey('')
  }

  const takeUrl = async () => {
    if (!url.trim()) return

    const entry = await run(() => addUrl(url, { key: key || undefined }))

    if (entry) {
      setUrl('')
      setKey('')
      if (onPick) onPick(entry)
    }
  }

  return (
    <section className={cx('ss-asset-library flex w-full flex-col gap-3', className)} {...rest}>
      <div
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          takeFiles(event.dataTransfer?.files)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        className={cx('flex flex-col gap-2 rounded-md border border-dashed p-3 transition-colors', over ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition-colors hover:border-slate-500"
          >
            {busy ? 'Working…' : 'Choose a file'}
          </button>
          <span className="text-xs text-slate-500">or drop one here, or paste a URL</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              takeUrl()
            }}
            placeholder="https://example.com/headshot.jpg"
            aria-label="Image URL"
            className="min-w-0 grow rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="name (optional)"
            aria-label="Asset name"
            className="w-36 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
          <button
            type="button"
            onClick={takeUrl}
            disabled={busy || !url.trim()}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-40"
          >
            Add URL
          </button>
        </div>

        {error ? <span className="text-xs text-rose-400">{error}</span> : null}

        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            takeFiles(event.target.files)
            event.target.value = ''
          }}
          aria-label="Add image files"
          className="hidden"
        />
      </div>

      {assets.length ? (
        <ul className="ss-asset-grid grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(7rem, 1fr))' }}>
          {assets.map((entry) => (
            <AssetTile
              key={entry.key}
              entry={entry}
              selected={selected === toAssetRef(entry.key)}
              onPick={onPick}
              onRemove={() => remove(entry.key)}
              onRename={(next) => rename(entry.key, next)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Nothing here yet. Drop an image in, or paste a URL.</p>
      )}
    </section>
  )
}

function AssetTile({ entry, selected, onPick, onRemove, onRename }) {
  const url = useAssetUrl(toAssetRef(entry.key))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.key)

  const commit = () => {
    setEditing(false)
    if (draft && draft !== entry.key) onRename(draft)
  }

  return (
    <li className={cx('ss-asset-tile group relative flex flex-col overflow-hidden rounded-md border', selected ? 'border-sky-500' : 'border-slate-800')}>
      <button
        type="button"
        onClick={() => onPick?.(entry)}
        disabled={!onPick}
        title={entry.kind === 'url' ? entry.url : `${entry.name} · ${Math.round((entry.size ?? 0) / 1024)}kB`}
        className="flex h-20 items-center justify-center bg-slate-950 p-1 disabled:cursor-default"
      >
        {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-slate-600">…</span>}
      </button>

      <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-1">
        {editing ? (
          <input
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') setEditing(false)
            }}
            aria-label={`Rename ${entry.key}`}
            className="min-w-0 grow rounded bg-slate-950 px-1 text-[11px] text-slate-100 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(entry.key)
              setEditing(true)
            }}
            title="Rename"
            className="min-w-0 grow truncate text-left text-[11px] text-slate-300 hover:text-white"
          >
            {entry.key}
          </button>
        )}
        <span
          className={cx('shrink-0 rounded px-1 text-[9px] uppercase', entry.kind === 'url' ? 'bg-slate-800 text-slate-400' : 'bg-slate-800 text-slate-500')}
        >
          {entry.kind}
        </span>
        <button type="button" onClick={onRemove} title={`Delete ${entry.key}`} className="shrink-0 text-[11px] text-slate-600 hover:text-rose-400">
          &times;
        </button>
      </div>
    </li>
  )
}

/**
 * The library in a modal, for opening from a picker.
 *
 * Sized by insets rather than by a width: it takes everything the viewport has
 * except a margin, which is the same gap the panels behind it sit in, so it reads
 * as a layer over the board rather than a box dropped on top of it. Browsing
 * images is the one job on this surface that wants area -- a fixed 44rem was
 * showing three tiles a row on a monitor with room for twelve, and the grid was
 * already built to fill whatever it is given.
 *
 * Two of these classes are load-bearing in ways that are easy to lose.
 *
 * `m-0`: a dialog is centred by `margin: auto` in the user-agent stylesheet, which
 * fights the insets. Without it the box lands at its content size in the middle and
 * the insets do nothing at all.
 *
 * `open:flex` rather than a bare `flex`: a closed dialog is hidden by
 * `dialog:not([open]) { display: none }`, and *any* display declaration of ours
 * beats it. A plain `flex` therefore leaves a full-screen invisible sheet over the
 * board at all times, swallowing every click on the panels behind it -- which
 * presents as the board going dead rather than as anything to do with a modal.
 */
export function AssetLibraryDialog({ open, onClose, ...rest }) {
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
      className="ss-asset-dialog fixed inset-3 m-0 h-auto max-h-none w-auto max-w-none flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/60 open:flex sm:inset-6"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Images</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the image library"
          title="Close"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <Icon name="close" />
        </button>
      </header>
      {/* min-h-0 is what lets this scroll: a flex child defaults to min-content
          height, which is tall enough for every tile and so never overflows. */}
      <div className="min-h-0 grow overflow-y-auto p-4">
        {/* Mounted only while open. Every ImagePicker renders one of these, so
            keeping the library alive behind a closed dialog meant N pickers ran N
            libraries -- all subscribing, all rendering tiles nobody could see. */}
        {open ? <AssetLibrary {...rest} /> : null}
      </div>
    </dialog>
  )
}
