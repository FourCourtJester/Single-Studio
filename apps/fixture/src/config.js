// The store id, shared by the studio definition and the SharedWorker host.
//
// One constant, imported by both, because these two have to agree: the id names
// the IndexedDB database and every BroadcastChannel. Hard-coding it in two places
// is how you get a control surface that looks connected and silently talks to
// nobody.
export const STUDIO_ID = 'demo'
