import { MINIMUM_VERSIONS } from '../velcro/support'

/**
 * Shown instead of the studio when the browser cannot run the store.
 *
 * Deliberately says what is missing and what to do, not "unsupported browser".
 * The person reading this is usually a companion operator on their own laptop
 * minutes before a show, so the useful content is the version they need.
 */
export function UnsupportedPage({ support, name }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-lg font-semibold">This browser can&rsquo;t run {name ?? 'the control surface'}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Everything below has to work for the board and the graphics to share one store. Updating your browser is the fix.
        </p>

        <ul className="mt-4 flex flex-col gap-3">
          {support.requirements.map(({ key, label, detail }) => (
            <li key={key} className="rounded-md border border-rose-900/60 bg-rose-950/40 p-3">
              <p className="text-sm font-medium text-rose-300">{label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{detail}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Minimum versions</h2>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
          {MINIMUM_VERSIONS.map(([browser, version]) => (
            <div key={browser} className="col-span-2 grid grid-cols-subgrid border-b border-slate-800 py-1 last:border-b-0">
              <dt className="text-slate-300">{browser}</dt>
              <dd className="text-slate-500">{version}+</dd>
            </div>
          ))}
        </dl>

        {support.missing.includes('moduleWorker') ? (
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            If you are seeing this inside OBS, its embedded browser is too old. OBS 28 and later ship a version that works.
          </p>
        ) : null}
      </div>
    </div>
  )
}
