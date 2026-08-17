// The store id, shared by the studio definition and the SharedWorker host.
//
// Keep it in one place: this id names the IndexedDB database and every
// BroadcastChannel, so the two have to agree exactly. Change it and you start
// from a clean slate.
export const STUDIO_ID = 'my-studio'
