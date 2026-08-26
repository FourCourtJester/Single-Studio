import { useEffect, useRef, useState } from 'react'

import { useAssetLibrary, useAssetUrl } from '../../hooks/useAssets'
import { useOwner } from '../../hooks/useSync'
import { groupOf, leafOf, toAssetRef } from '../../velcro/assets'
import { filesFromDrop } from '../../toolkits/entries'
import { cx } from '../../toolkits/cx'
import { Confirm } from './Confirm'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'

/**
 * Manage the studio's images: add, name, preview, remove.
 *
 * Two ways in, because images arrive two ways. A file gets dropped or chosen; a URL
 * gets pasted. Both become a named entry, so a graphic points at "ada-okafor"
 * rather than a hash or a link -- which is the name an operator recognises under
 * pressure, and means repointing a slot is a rename here rather than an edit
 * everywhere it is used.
 *
 * A key can be a path -- `players/ada-okafor` -- and that slash is the whole
 * organisation scheme. A hundred images in one flat list is a scroll an operator
 * has to read; the same hundred under `players/`, `logos/`, `maps/` is a menu they
 * can aim at. Groups are not a separate concept with its own storage and its own
 * editing UI: the key already existed, renaming it already worked, and a graphic
 * still points at one string.
 *
 * Dropping or picking a folder files its contents under the folder's name, which
 * is how a hundred images arrive in one motion and come out organised.
 *
 * **Files are added on the machine running OBS; URLs are added by anybody.** Not a
 * permission model -- a physical fact. A file's bytes exist only where it was
 * dropped, so a headshot added on a producer's laptop cannot be drawn by the
 * machine going to air: the graphic renders blank on air while the producer's own
 * screen shows the photo, which is the wrong direction for a failure to be
 * invisible in. A URL has no such problem, because it is a reference rather than
 * bytes and every machine fetches it independently. So the URL row stays live for
 * everyone and the file buttons stand down, which is the whole rule.
 *
 * Rendered inline as a panel, or inside AssetLibraryDialog as a modal. `onPick`
 * turns it into a chooser.
 *
 * @param {object} props
 * @param {(entry: { key: string }) => void} [props.onPick] - turns the library into a chooser
 * @param {string} [props.selected] - the `asset:<key>` currently chosen, when choosing
 * @param {string} [props.className] - added to the component's own classes
 */
export function AssetLibrary({ onPick, selected, className, ...rest }) {
  const { assets, addFiles, addUrl, remove, removeAll, rename } = useAssetLibrary()
  const owner = useOwner()
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [over, setOver] = useState(false)
  const [filter, setFilter] = useState('')
  const input = useRef(null)
  const folder = useRef(null)

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

  /**
   * Takes plain Files or the `{ file, path }` pairs a walked drop produces.
   *
   * The typed field means "key" for one loose file and "group" for anything else --
   * the same field meaning the same thing at two scales. What decides is whether
   * the file arrived with a folder above it, not merely whether it arrived alone: a
   * folder holding one image is still a folder being filed, and treating its typed
   * group as that image's whole key would throw the filename away.
   */
  const takeFiles = async (items) => {
    // Guarded here rather than only on the buttons. A drop target is not a button,
    // and this is the one path where letting something through produces a graphic
    // that is blank on air and correct on the screen of whoever added it.
    if (!owner) {
      setError('Only the machine running OBS can add image files. Paste a URL instead — those work everywhere.')
      return
    }

    const chosen = [...(items ?? [])].filter((item) => (item?.file ?? item)?.type?.startsWith('image/'))

    if (!chosen.length) {
      setError('no images in that')
      return
    }

    const pathOf = (item) => item?.path || (item?.file ?? item)?.webkitRelativePath || ''
    const lone = chosen.length === 1 && !pathOf(chosen[0]).includes('/')

    const result = await run(() =>
      addFiles(lone && key ? [{ file: chosen[0].file ?? chosen[0], path: key }] : chosen, {
        group: lone ? undefined : key || undefined,
        onProgress: chosen.length > 4 ? setProgress : undefined,
      }),
    )

    setProgress(null)

    if (result?.failed?.length) setError(`${result.failed.length} of ${chosen.length} could not be read`)
    if (result?.added?.length === 1 && onPick) onPick(result.added[0])
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

  // Ungrouped entries sort last: they are the leftovers, and a heading-less block
  // above a set of named ones reads as a mistake rather than as a category.
  const needle = filter.trim().toLowerCase()
  const groups = [
    ...assets
      .filter((entry) => !needle || entry.key.toLowerCase().includes(needle))
      .reduce((map, entry) => {
        const group = groupOf(entry.key)

        return map.set(group, [...(map.get(group) ?? []), entry])
      }, new Map()),
  ].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))

  return (
    <section className={cx('ss-asset-library flex w-full flex-col gap-3', className)} {...rest}>
      <div
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          // Captured synchronously inside the handler: dataTransfer items are gone
          // by the time an await resolves.
          filesFromDrop(event.dataTransfer).then(takeFiles)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(owner)
        }}
        onDragLeave={() => setOver(false)}
        className={cx('flex flex-col gap-2 rounded-md border border-dashed p-3 transition-colors', over ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700')}
      >
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
            placeholder="name or group (optional)"
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

        {/* Under the URL line, not above it. Pasting a link is the common case on a
            board -- a logo lives somewhere already -- and the file button was
            sitting in front of it collecting the first glance every time. */}
        {owner ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition-colors hover:border-slate-500 disabled:opacity-40"
            >
              Choose files
            </button>
            <button
              type="button"
              onClick={() => folder.current?.click()}
              disabled={busy}
              className="ss-choose-folder rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition-colors hover:border-slate-500 disabled:opacity-40"
            >
              Choose a folder
            </button>
            <span className="text-xs text-slate-500">
              {progress
                ? `${progress.done} of ${progress.total}…`
                : busy
                  ? 'Working…'
                  : 'or drop them here. A folder files itself under its own name; type a group above to use that instead.'}
            </span>
          </div>
        ) : (
          /* Said plainly, and said as a fact about where the file is rather than as
             a permission being withheld. An operator who reads "you cannot" goes
             looking for the setting that lets them; one who reads "it would not
             reach the machine that draws it" pastes a link instead. */
          <p className="ss-files-elsewhere text-xs text-slate-500">
            Image <em className="not-italic text-slate-400">files</em> are added on the machine running OBS &mdash; it is the one that has to draw them, and a
            file dropped here would never reach it. A URL works from anywhere.
          </p>
        )}

        {error ? <span className="text-xs text-rose-400">{error}</span> : null}

        {/* Not rendered at all off the OBS machine, rather than hidden and inert. A
            file input that exists is a file input something can reach -- a test, a
            script, a stray click -- and the DOM should say what is true. */}
        {owner ? (
          <>
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

            {/* webkitdirectory is the only way to pick a folder, and every browser that
                matters supports it under that vendor name. React needs it lowercase. */}
            <input
              ref={folder}
              type="file"
              accept="image/*"
              multiple
              webkitdirectory=""
              onChange={(event) => {
                takeFiles(event.target.files)
                event.target.value = ''
              }}
              aria-label="Add a folder of images"
              className="hidden"
            />
          </>
        ) : null}
      </div>

      {assets.length ? (
        <>
          {/* Only once there is enough to lose something in. Below that the filter
              is a control asking to be used on a list you can already see. */}
          {assets.length > 8 ? (
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter by name or group…"
              aria-label="Filter images"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          ) : null}

          {groups.length ? (
            groups.map(([group, entries]) => (
              <section key={group || '—'} className="ss-asset-group flex flex-col gap-1.5">
                {/* The ungrouped block gets a heading only when something above it
                    has one. On a flat library it would be a label for everything,
                    which is no label at all; under a set of named groups its absence
                    reads as a rendering fault. */}
                {group || groups.length > 1 ? (
                  <h3 className="flex items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {group || <span className="text-slate-600">ungrouped</span>}
                    <span className="text-[0.65rem] normal-case tracking-normal text-slate-600">{entries.length}</span>
                  </h3>
                ) : null}
                <ul className="ss-asset-grid grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(7rem, 1fr))' }}>
                  {entries.map((entry) => (
                    <AssetTile
                      key={entry.key}
                      entry={entry}
                      selected={selected === toAssetRef(entry.key)}
                      onPick={onPick}
                      onRemove={() => remove(entry.key)}
                      onRename={(next) => rename(entry.key, next)}
                      owner={owner}
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <p className="text-xs text-slate-500">Nothing matches &ldquo;{filter}&rdquo;.</p>
          )}
        </>
      ) : (
        <p className="py-8 text-center text-xs text-slate-500">
          {owner
            ? 'Nothing here yet. Drop images or a folder in, or paste a URL.'
            : 'Nothing here yet. Paste a URL above, or ask the machine running OBS to add files.'}
        </p>
      )}

      {/* Not offered while picking. A chooser is opened to answer "which image",
          and the one control on the screen that answers "none of them, ever" does
          not belong in that moment.

          It clears the room's index as well as this machine's bytes, and says so:
          an entry every board can still see but no board can draw is worse than no
          entry, because a picker keeps offering it. */}
      {!onPick && assets.length ? (
        <div className="ss-asset-purge flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
          <Confirm onConfirm={() => run(removeAll)} disabled={busy} label={`Remove all ${assets.length}`} className="px-2 py-1 text-xs" />
          <span className="text-xs text-slate-500">Everything above, off this machine and out of the show. It cannot be undone.</span>
        </div>
      ) : null}
    </section>
  )
}

function AssetTile({ entry, selected, onPick, onRemove, onRename, owner }) {
  const url = useAssetUrl(toAssetRef(entry.key))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.key)

  const commit = () => {
    setEditing(false)
    if (draft && draft !== entry.key) onRename(draft)
  }

  return (
    <li
      className={cx(
        'ss-asset-tile group relative flex flex-col overflow-hidden rounded-md border',
        selected ? 'border-sky-500' : 'border-slate-800',
        entry.here === false && 'ss-elsewhere border-dashed opacity-60',
      )}
    >
      <button
        type="button"
        onClick={() => onPick?.(entry)}
        disabled={!onPick}
        title={
          entry.here === false
            ? owner
              ? 'Added on another machine. This one does not hold the image, so it may not show on air either.'
              : 'Lives on the machine running OBS. It will go to air; this board just cannot preview it.'
            : entry.kind === 'url'
              ? entry.url
              : `${entry.name} · ${Math.round((entry.size ?? 0) / 1024)}kB`
        }
        className="flex h-20 items-center justify-center bg-slate-950 p-1 disabled:cursor-default"
      >
        {url ? (
          <img src={url} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="px-1 text-center text-[10px] leading-tight text-slate-600">
            {entry.here === false ? (owner ? 'on another machine' : 'on the studio machine') : '…'}
          </span>
        )}
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
            title={`Rename ${entry.key}`}
            className="ss-asset-name min-w-0 grow cursor-text truncate text-left text-[11px] text-slate-300 decoration-slate-600 decoration-dotted underline-offset-2 hover:text-white hover:underline"
          >
            {leafOf(entry.key)}
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
        <Tooltip label="Close" align="end" className="ml-auto">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the image library"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            <Icon name="close" />
          </button>
        </Tooltip>
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
