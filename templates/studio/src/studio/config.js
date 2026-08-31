// YOURS — set this once, when you start.
/**
 * The name this studio's data is stored under.
 *
 * It names the IndexedDB databases that hold your show, and the SharedWorker that
 * every tab shares -- so the board, the previews and every browser source all find
 * each other by it. Change it and you start from an empty show.
 *
 * It lives in its own file because both sides import it: `studio.js` on the page and
 * `velcro.worker.js` in the worker, which are separate bundles. They have to agree.
 */
export const STUDIO_ID = 'my-studio'
