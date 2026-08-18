import { useState } from 'react'

import { useAssetLibrary, useAssetUrl } from '../../hooks/useAssets'
import { useDraftValue } from '../../studio/DraftProvider'
import { assetKeyOf, isAssetRef, toAssetRef } from '../../velcro/assets'
import { cx } from '../../toolkits/cx'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'
import { AssetLibraryDialog } from './AssetLibrary'

/**
 * Point a path at an image from the library.
 *
 * A preview of what is selected, a dropdown of the library's keys for a quick
 * swap, and a magnifier that opens the library itself for adding, renaming and
 * deleting. The dropdown is the fast path -- an operator changing guests between
 * segments knows the name and does not need the grid.
 *
 * The two are joined into one control rather than sitting apart, which is what
 * makes the magnifier legible without a word on it: butted against a dropdown of
 * names, "search these" is the only thing it can mean. It also buys back the width
 * a "Browse" button was spending, and in a narrow dock that width is the difference
 * between the names being readable and being truncated.
 *
 * Selecting is *staged* like any other field, so nothing reaches air until save.
 * Adding to the library is not staged: a file arriving is not a broadcast change.
 * That split is what lets an operator line up the next guest mid-segment and commit
 * on the cut.
 */
export function ImagePicker({ name, label = 'Image', namespace = 'variables', className, ...rest }) {
  const path = `${namespace}.${name}`
  const { value, dirty, onChange } = useDraftValue(path)
  const { assets } = useAssetLibrary()
  const preview = useAssetUrl(value || null)
  const [browsing, setBrowsing] = useState(false)

  // A path may hold a raw URL from before it was managed, or a key that has since
  // been deleted. Show that rather than silently pretending nothing is set.
  const key = assetKeyOf(value)
  const known = key ? assets.some((entry) => entry.key === key) : false
  const orphaned = Boolean(value) && (isAssetRef(value) ? !known : true)

  return (
    <section className={cx('ss-image-picker flex w-full flex-col gap-2', className)} {...rest}>
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
        {dirty ? <span aria-label="unsaved" title="Unsaved" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
      </span>

      <div className="flex items-center gap-3">
        <div
          className={cx(
            'flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-950 ring-1',
            dirty ? 'ring-amber-500/70' : 'ring-slate-800',
          )}
        >
          {preview ? <img src={preview} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-600">none</span>}
        </div>

        <div className="flex min-w-0 grow flex-col gap-1.5">
          {/* One control in two halves: the divider between them is the select's
              own right border, so they read as joined rather than adjacent. */}
          <div className="ss-input-group flex">
            <select
              value={known ? value : ''}
              onChange={(event) => onChange(event.target.value)}
              aria-label={`${label} selection`}
              className="min-w-0 grow rounded-l-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500 focus:relative"
            >
              <option value="">— none —</option>
              {assets.map((entry) => (
                <option key={entry.key} value={toAssetRef(entry.key)}>
                  {entry.key}
                </option>
              ))}
            </select>
            <Tooltip label="Browse the image library" align="end">
              <button
                type="button"
                onClick={() => setBrowsing(true)}
                aria-label={`Browse images for ${label}`}
                className="ss-browse -ml-px flex h-full shrink-0 items-center justify-center rounded-r-md border border-slate-700 bg-slate-800 px-2.5 text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-700 hover:text-white focus:relative"
              >
                <Icon name="search" />
              </button>
            </Tooltip>
          </div>

          {orphaned ? (
            <span className="truncate text-xs text-amber-400" title={value}>
              {isAssetRef(value) ? `"${key}" is not in the library` : value}
            </span>
          ) : null}
        </div>
      </div>

      <AssetLibraryDialog
        open={browsing}
        onClose={() => setBrowsing(false)}
        selected={value}
        onPick={(entry) => {
          onChange(toAssetRef(entry.key))
          setBrowsing(false)
        }}
      />
    </section>
  )
}
