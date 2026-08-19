import { useEffect, useRef, useState } from 'react'

import { useStudio } from '../../studio/context'
import { cx } from '../../toolkits/cx'
import { Icon } from '../common/Icon'
import { LAYER_NAME } from '../../toolkits/url'
import { Tooltip } from '../common/Tooltip'
import { titleize } from '../../toolkits/slug'

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
 * The name it carries is `SS - <studio> - <Source>`, which is built for a scene list
 * rather than for reading here. The prefix groups every source this framework
 * produced together in an alphabetical list, the studio name separates two shows
 * living in one OBS profile, and the source name is title-cased from its key so
 * nobody has to maintain a second copy of it.
 *
 * What is *shown* is the bare URL. The encoded parameter roughly doubles the length
 * of every line for something nobody reads off the screen -- it only has to survive
 * the clipboard.
 */
/**
 * Marks a scene entry as this framework's.
 *
 * One line to change, and deliberately short: it is repeated on every source in a
 * scene list that is often only a couple of dozen characters wide.
 */
const PREFIX = 'SS'

export function SourceList({ bare = false, className }) {
  const { studio } = useStudio()
  const [copied, setCopied] = useState(null)
  const names = Object.keys(studio.sources)

  const base = () => `${window.location.origin}${window.location.pathname}`

  /** What is shown: readable, and what you would type. */
  const urlFor = (name) => `${base()}#/source/${name}`

  /** What OBS will call the source. See the note above for why it is shaped so. */
  const layerNameFor = (name) => `${PREFIX} - ${studio.name} - ${titleize(name)}`

  /** What is copied and linked: the same page, named for OBS. */
  const obsUrlFor = (name) => `${base()}?${LAYER_NAME}=${encodeURIComponent(layerNameFor(name))}#/source/${name}`

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
    <section className={cx(bare ? '' : 'rounded-lg border border-slate-800 bg-slate-900/40 p-4', className)}>
      {bare ? null : <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Browser sources</h2>}
      <p className="mb-3 text-xs text-slate-500">
        Add each of these to OBS as a Browser source. Leave &ldquo;Shutdown source when not visible&rdquo; unchecked so state stays warm. Use Copy rather than
        retyping: it adds <code className="text-slate-400">?{LAYER_NAME}=</code>, which is what OBS names the source from &mdash; each one arrives as{' '}
        <code className="text-slate-400">{`${PREFIX} - ${studio.name} - …`}</code>{' '}
        rather than as another &ldquo;localhost&rdquo;.
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
            <span className="ss-source-name text-sm font-medium text-slate-200">{titleize(name)}</span>
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

/**
 * The same list as a modal, for the menu.
 *
 * It used to sit permanently at the bottom of the board, which is the wrong shape
 * for what it is: wiring OBS is a once-ever job, and the panel spent every show
 * after that taking up the space under the controls an operator actually uses.
 */
export function SourceListDialog({ open, onClose }) {
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
      className="ss-sources-dialog m-auto w-[min(46rem,94vw)] max-h-[86vh] rounded-lg border border-slate-800 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/60 open:flex open:flex-col"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Browser sources</h2>
        <Tooltip label="Close" align="end" className="ml-auto">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the source list"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            <Icon name="close" />
          </button>
        </Tooltip>
      </header>
      <div className="min-h-0 grow overflow-y-auto p-4">{open ? <SourceList bare /> : null}</div>
    </dialog>
  )
}
