// SharedWorker entry. Imported only by a studio's `velcro.worker.js`, so React
// never ends up in the worker bundle.

export { createVelcroHost } from './velcro/host'
// A plugin runs in the worker, so its author writes against this entry rather than
// the main one -- which is also what keeps React out of a plugin's dependencies.
export { defaultConfig, definePlugin, PluginBase, PluginHandler } from './services/plugin'
export { Service } from './services/Service'
export { SocketService } from './services/SocketService'
export { PollingService } from './services/PollingService'
export { Emitter } from './toolkits/emitter'
// A plugin that reports a clock wants to hand over a face as well as a number, and
// the alternative is every plugin growing its own mm:ss.
export { formatDuration, parseDuration } from './toolkits/time'
export { mutations } from './velcro/mutations'
export * as Doc from './velcro/doc'
export * as Paths from './velcro/paths'
