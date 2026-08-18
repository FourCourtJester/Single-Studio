import { useState } from 'react'

import { useStudio } from '../../studio/context'
import { cx } from '../../toolkits/cx'

/**
 * Every source's browser-source URL, ready to paste into OBS.
 *
 * This exists because the first thing anyone does with a new studio is wire it
 * into OBS, and hand-assembling a dozen `#/source/...` URLs is where people give
 * up. Rendered on the control page by default.
 *
 * Each URL carries `?title=`, which the source page applies to `document.title`.
 * Hash routing means every source shares one origin and one path, so anything that
 * names a page from its URL or its title sees a dozen identical pages -- which is
 * where a scene full of "localhost", "localhost (2)", "localhost (3)" comes from.
 * The parameter sits before the hash so it is part of the URL proper.
 */
export function SourceList({ className }) {
  const { studio } = useStudio()
  const [copied, setCopied] = useState(null)
  const names = Object.keys(studio.sources)

  const urlFor = (name) => {
    const title = encodeURIComponent(`${studio.name} ${name}`)

    return `${window.location.origin}${window.location.pathname}?title=${title}#/source/${name}`
  }

  const copy = async (name) => {
    try {
      await navigator.clipboard.writeText(urlFor(name))
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
        Add each of these to OBS as a Browser source. Leave &ldquo;Shutdown source when not visible&rdquo; unchecked so state stays warm. The{' '}
        <code className="text-slate-400">?title=</code> on the end names the page, so a scene of these does not come back as a list of identical entries &mdash;
        edit it if you want the source called something else.
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
            <a href={`#/source/${name}`} target="_blank" rel="noreferrer" className="ml-auto truncate text-xs text-sky-400 hover:underline">
              {urlFor(name)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
