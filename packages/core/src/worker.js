// SharedWorker entry. Imported only by a studio's `velcro.worker.js`, so React
// never ends up in the worker bundle.

export { createVelcroHost } from './velcro/host'
export { mutations } from './velcro/mutations'
export * as Doc from './velcro/doc'
export * as Paths from './velcro/paths'
