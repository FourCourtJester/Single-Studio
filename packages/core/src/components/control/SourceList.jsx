import { useState } from 'react'

import { useStudio } from '../../studio/context'
import { cx } from '../../toolkits/cx'
import { LAYER_NAME } from '../../toolkits/url'

/**
 * Every source's browser-source URL, ready to paste into OBS.
 *
 * This exists because the first thing anyone does with a new studio is wire it
 * into OBS, and hand-assembling a dozen `#/source/...` URLs is where people give
 * up. Rendered on the control page by default.
 *
 * Two forms of the same URL, on purpose.
 *
 * What an operator copies carries `?layer-name=`, which is what OBS reads to name a
 * browser source. Hash routing means every source on a studio shares one origin and
 * one path, so without it OBS sees a dozen identical pages and produces a scene full
 * of "localhost", "localhost (2)", "localhost (3)". The parameter sits ahead of the
 * hash because that is where OBS looks.
 *
 * What is *shown* is the bare URL. The encoded parameter roughly doubles the length
 * of every line for something nobody reads off the screen -- it only has to survive
 * the clipboard.
 */
export function SourceList({ className }) {
  const { studio } = useStudio()
  const [copied, setCopied] = useState(null)
  const names = Object.keys(studio.sources)

  const base = () => `${window.location.origin}${window.location.pathname}`

  /** What is shown: readable, and what you would type. */
  const urlFor = (name) => `${base()}#/source/${name}`

  /** What is copied and linked: the same page, named for OBS. */
  const obsUrlFor = (name) => `${base()}?${LAYER_NAME}=${encodeURIComponent(`${studio.name} ${name}`)}#/source/${name}`

  const copy = async (name) => {
    try {
      await navigator.clipboard.writeText(obsUrlFor(name))
      setCopied(name)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setCopied(null)
    }
  }

  if (!names.length) {
    return (
      <section className={cx('rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-500', className)}>
        No sources registered yet. Add one to the <code className="text-slate-300">sources</code> map in your studio definition.
      </section>
    )
  }

  return (
    <section className={cx('rounded-lg border border-slate-800 bg-slate-900/40 p-4', className)}>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Browser sources</h2>
      <p className="mb-3 text-xs text-slate-500">
        Add each of these to OBS as a Browser source. Leave &ldquo;Shutdown source when not visible&rdquo; unchecked so state stays warm. Use Copy rather than
        retyping: it adds <code className="text-slate-400">?{LAYER_NAME}=</code>, which is what OBS names the source from. Without it a scene of these comes
        back as a list of identical entries.
      </p>
      <ul className="flex flex-col gap-2">
        {names.map((name) => (
          <li key={name} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copy(name)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-slate-500"
            >
              {copied === name ? 'Copied' : 'Copy'}
            </button>
            <span className="text-sm font-medium text-slate-200">{name}</span>
            <a
              href={obsUrlFor(name)}
              target="_blank"
              rel="noreferrer"
              title={obsUrlFor(name)}
              className="ml-auto truncate text-xs text-sky-400 hover:underline"
            >
              {urlFor(name)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
