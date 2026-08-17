// A studio is declared once, as data.
//
// The old build globbed `src/studios/*` with a webpack context require, which is
// why adding a studio meant forking the framework. Here the studio owns its own
// repo and hands the framework an explicit registry, so nothing is discovered by
// path convention and every source is tree-shakeable.

export function defineStudio(config) {
  const { name, id, sources = {}, control, worker, basename } = config

  if (!name) throw new Error('defineStudio() requires a `name`')
  if (typeof worker !== 'function') throw new Error('defineStudio() requires `worker`: () => new SharedWorker(...)')
  if (typeof control !== 'function') throw new Error('defineStudio() requires `control`: () => import("./Control")')

  for (const [key, loader] of Object.entries(sources)) {
    if (typeof loader !== 'function') throw new Error(`Source "${key}" must be a loader function: () => import("./sources/${key}")`)
  }

  // `id` is the store identity: it names the IndexedDB database and every
  // BroadcastChannel. `name` is only ever shown to a human. They are separate so
  // renaming the studio in the UI cannot orphan a show's persisted state.
  return Object.freeze({ name, id: id ?? name, sources, control, worker, basename })
}
