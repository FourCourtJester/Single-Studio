// Capability check, run before the store is created.
//
// The failure this exists for is nasty because it is silent. `new SharedWorker(url,
// options)` takes `(DOMString or WorkerOptions)` as its second argument, so a
// browser that predates the options object does not throw on
// `{ type: 'module' }` -- it stringifies it to "[object Object]", uses that as the
// worker's *name*, and loads the script as a classic worker. The `import`
// statements inside then fail somewhere the page never sees. The operator gets a
// board where nothing updates and no error, which is the worst way to find out.
//
// Detection is behavioural rather than a version sniff: hand the constructor an
// options object whose `type` is a getter and see whether it gets read. Only an
// implementation that actually treats the argument as WorkerOptions will touch it.
// The getter fires during argument processing, before any script fetch, so the
// answer is known even if the probe worker never loads.
//
// Relevant floors: Chrome/Edge 83, Firefox 114, Safari 16. Also OBS itself --
// OBS 27 and earlier embed CEF 75 (Chromium 75) and will fail this check; OBS 28+
// ships CEF 103 and passes.

const REQUIREMENTS = {
  sharedWorker: {
    label: 'Shared workers',
    detail: 'The control surface and every graphic share one store through a SharedWorker.',
  },
  moduleWorker: {
    label: 'ES modules in shared workers',
    detail: 'Your browser has SharedWorker but ignores the { type: "module" } option, so the store script cannot load.',
  },
  broadcastChannel: {
    label: 'BroadcastChannel',
    detail: 'Used to push each value to only the graphics that subscribed to it.',
  },
}

export const MINIMUM_VERSIONS = [
  ['Chrome / Edge', '83'],
  ['Firefox', '114'],
  ['Safari', '16'],
  ['OBS (embedded browser)', '28'],
]

/**
 * The same promise, in the spelling a build tool wants.
 *
 * Vite's `build.cssTarget` falls back to `build.target`, which is a *JavaScript*
 * target: `es2022` says nothing about CSS, so the CSS pipeline is told nothing and
 * lowers nothing. Anything Tailwind processes is lowered by Lightning CSS on the way
 * through and is fine either way; a stylesheet imported straight from a component
 * misses that and ships exactly as written -- so a studio using CSS nesting shipped
 * rules that do nothing at all on any browser older than Chrome 112.
 *
 * Silent in both directions, which is why it sat unnoticed: it is invisible on any
 * browser new enough to run the CSS as written, and that is every browser anybody
 * develops on. It would first appear on somebody else's older machine, as whole
 * blocks of a stylesheet failing at once.
 *
 * Derived from the table above rather than written out again, because the two have
 * to agree and a config file is not where anybody looks for a support policy. OBS is
 * left out: it is Chromium, and its own version numbering means nothing to esbuild.
 */
export const CSS_TARGET = MINIMUM_VERSIONS.filter(([browser]) => browser !== 'OBS (embedded browser)').map(
  ([browser, version]) => `${browser.split(' ')[0].toLowerCase()}${version}`,
)

/**
 * Does this browser honour `{ type: 'module' }` on SharedWorker?
 *
 * Uses a blob URL holding an empty script so the probe is silent either way: a
 * browser that reads the option loads nothing, and one that mistakes the object
 * for a name also loads nothing. Construction errors are reported separately --
 * the getter has already told us what we came to find out.
 */
function probeModuleWorker() {
  let readType = false
  let constructError = null

  const options = {
    name: 'velcro-support-probe',
    get type() {
      readType = true
      return 'module'
    },
  }

  let url = null

  try {
    url = URL.createObjectURL(new Blob([''], { type: 'text/javascript' }))

    const probe = new SharedWorker(url, options)

    probe.port.close()
  } catch (err) {
    constructError = err
  } finally {
    if (url) URL.revokeObjectURL(url)
  }

  return { supported: readType, constructError }
}

function detect() {
  const missing = []
  const hasSharedWorker = typeof globalThis.SharedWorker === 'function'
  const hasBroadcastChannel = typeof globalThis.BroadcastChannel === 'function'

  if (!hasSharedWorker) missing.push('sharedWorker')
  if (!hasBroadcastChannel) missing.push('broadcastChannel')

  // Only meaningful if SharedWorker exists at all, and needs Blob/URL to probe
  // safely -- if those are absent we are not in a browser worth guarding.
  const canProbe = hasSharedWorker && typeof globalThis.Blob === 'function' && typeof globalThis.URL?.createObjectURL === 'function'
  const probe = canProbe ? probeModuleWorker() : null

  if (canProbe && !probe.supported) missing.push('moduleWorker')

  return {
    ok: missing.length === 0,
    missing,
    // Persistence is not in `missing`: the host falls back to an in-memory doc,
    // which still drives graphics correctly for the length of a session.
    persistent: typeof globalThis.indexedDB === 'object' && globalThis.indexedDB !== null,
    requirements: missing.map((key) => ({ key, ...REQUIREMENTS[key] })),
    probeError: probe?.constructError ?? null,
  }
}

let cached = null

/**
 * Memoized capability report. A plain function rather than a hook, so callers can
 * branch on it before any hook runs.
 */
export function getSupport() {
  if (!cached) cached = detect()
  return cached
}

/** Test seam: forget the memoized result. */
export function resetSupport() {
  cached = null
}
