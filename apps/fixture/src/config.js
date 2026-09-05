// What this studio is called, in both senses.
//
// The id is shared by the studio definition and the SharedWorker host: one
// constant, imported by both, because these two have to agree -- it names the
// IndexedDB database and every BroadcastChannel. Hard-coding it in two places is
// how you get a control surface that looks connected and silently talks to nobody.
//
// The name is only ever shown to a human, and sits here so that renaming a studio
// is one file rather than a search.
export const STUDIO_NAME = 'Demo'
export const STUDIO_ID = 'demo'
