import { slugify } from '../toolkits/slug'

// Turning a folder of graphics into the registry, so adding one is adding a file.
//
// `defineStudio` takes an explicit map on purpose -- the version before this globbed
// `src/studios/*` with a webpack context require, which is why adding a studio meant
// forking the framework. That objection was to *runtime* discovery, and it still
// stands. This is not that.
//
// `import.meta.glob` is resolved by the bundler at build time. Vite rewrites the
// call into a literal object of dynamic imports before any code runs, so every
// graphic is still statically known, still code-split into its own chunk, and still
// tree-shakeable. Nothing is looked up by a path the framework was handed.
//
// The glob stays in the studio rather than in here, which is what keeps the
// framework bundler-agnostic: core never touches `import.meta`, it only takes the
// object one produced.
//
//   sources: sourcesFrom(import.meta.glob('./sources/**/*.jsx')),
//
// **Everything under that folder becomes a browser source.** A shared plate, a hook,
// a helper -- anything living there turns up in the operator's list and in OBS. Keep
// them somewhere else; `src/components/` is the obvious home.

/**
 * `./sources/lower-thirds/Guest.jsx` becomes `lower-thirds/guest`.
 *
 * The folder being globbed is dropped, the extension goes, and each remaining
 * segment is slugged. Case boundaries are word breaks first, so a file named the way
 * a React component is named -- `LowerThird.jsx` -- becomes `lower-third` rather than
 * `lowerthird`, which is what the URL, the OBS layer name and the title all read
 * back out of.
 */
function keyFor(path) {
  const segments = String(path)
    .replace(/\.[a-z]+$/i, '')
    .split('/')
    .filter(Boolean)
    // `.` and `..` are where the glob was written from, not part of the name. A
    // studio that keeps its definition in a subfolder globs `../sources/**`, and
    // counting `..` as a segment made "drop the globbed folder" drop the `..`
    // instead -- naming every graphic `sources/scoreboard`, which is a browser
    // source URL that resolves to nothing.
    .filter((part) => part !== '.' && part !== '..')

  // Drop the globbed folder itself, but never the only thing there is.
  const parts = segments.length > 1 ? segments.slice(1) : segments

  return parts
    .map((part) => slugify(part.replace(/([a-z0-9])([A-Z])/g, '$1-$2')))
    .filter(Boolean)
    .join('/')
}

/**
 * @param {Record<string, () => Promise<unknown>>} modules - what `import.meta.glob` returned
 * @returns {Record<string, () => Promise<unknown>>} a `sources` registry for `defineStudio`
 */
export function sourcesFrom(modules) {
  const sources = {}

  for (const [path, load] of Object.entries(modules ?? {})) {
    const key = keyFor(path)

    if (!key) throw new Error(`Could not name a source from "${path}". Give it a filename.`)

    // Two files cannot answer to one URL. Silently keeping the last would mean a
    // graphic that is registered, listed, and never the one that loads.
    if (sources[key]) throw new Error(`Two sources would both be "${key}". Rename one of them; keys come from the file path.`)

    sources[key] = load
  }

  return sources
}
