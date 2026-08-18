import { useRef, useState } from 'react'

import { useAssetLibrary, useAssetUrl } from '../../hooks/useAssets'
import { useDraftValue } from '../../studio/DraftProvider'
import { isAssetRef, toAssetRef } from '../../velcro/assets'
import { cx } from '../../toolkits/cx'

/**
 * Drop an image in, put it on air.
 *
 * The workflow this is for: a guest sends a headshot minutes before the show. There
 * is no time to patch a repo, and they sent a file rather than a link. Dropping it
 * here stores the bytes locally and writes an `asset:` reference to the path.
 *
 * Uploading and assigning are separate on purpose. The bytes land in the store
 * immediately -- that is not a broadcast change, it is a file arriving -- but the
 * path is *staged* like any other field, so nothing reaches air until save. An
 * operator can line up the next guest mid-segment and commit on the cut.
 *
 * The library below the drop zone is the same store, so a returning guest is one
 * click rather than another upload, and identical bytes never duplicate.
 */
export function ImagePicker({ name, label = 'Image', namespace = 'variables', accept = 'image/*', className, ...rest }) {
  const path = `${namespace}.${name}`
  const { value, dirty, onChange } = useDraftValue(path)
  const { assets, add, remove } = useAssetLibrary()
  const preview = useAssetUrl(value || null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [error, setError] = useState(null)
  const input = useRef(null)

  const accept_ = async (fileList) => {
    const file = fileList?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError(`${file.name} is not an image`)
      return
    }

    setBusy(true)
    setError(null)

    try {
      const meta = await add(file)

      onChange(toAssetRef(meta.id))
    } catch (err) {
      setError(err?.message ?? 'could not store that file')
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (event) => {
    event.preventDefault()
    setOver(false)
    accept_(event.dataTransfer?.files)
  }

  return (
    <section className={cx('ss-image-picker flex w-full flex-col gap-2', className)} {...rest}>
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
        {dirty ? <span aria-label="unsaved" title="Unsaved" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
      </span>

      <div
        onDrop={onDrop}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        className={cx(
          'flex items-center gap-3 rounded-md border border-dashed p-3 transition-colors',
          over ? 'border-sky-500 bg-sky-500/10' : dirty ? 'border-amber-500/70' : 'border-slate-700',
        )}
      >
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-950">
          {preview ? <img src={preview} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-600">none</span>}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="self-start rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition-colors hover:border-slate-500"
          >
            {busy ? 'Storing…' : 'Choose or drop an image'}
          </button>
          {value ? (
            <button type="button" onClick={() => onChange('')} className="self-start text-xs text-slate-500 transition-colors hover:text-slate-300">
              Clear
            </button>
          ) : null}
          {error ? <span className="text-xs text-rose-400">{error}</span> : null}
        </div>

        <input
          ref={input}
          type="file"
          accept={accept}
          onChange={(event) => {
            accept_(event.target.files)
            event.target.value = ''
          }}
          aria-label={`${label} file`}
          className="hidden"
        />
      </div>

      {assets.length ? (
        <div className="flex flex-wrap gap-2">
          {assets.map((meta) => {
            const ref = toAssetRef(meta.id)
            const selected = value === ref

            return (
              <div key={meta.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onChange(ref)}
                  title={`${meta.name} · ${Math.round(meta.size / 1024)}kB`}
                  className={cx(
                    'flex h-12 w-12 items-center justify-center overflow-hidden rounded border bg-slate-950 transition-colors',
                    selected ? 'border-sky-500' : 'border-slate-800 hover:border-slate-600',
                  )}
                >
                  <Thumb id={meta.id} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(meta.id)}
                  title={`Delete ${meta.name}`}
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] leading-none text-white group-hover:flex"
                >
                  &times;
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

function Thumb({ id }) {
  const url = useAssetUrl(toAssetRef(id))

  return url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : null
}

export const assetRef = toAssetRef
export const isAsset = isAssetRef
