const worker = new SharedWorker(new URL('./ws.js', import.meta.url), { name: 'obs.js' } /* webpackChunkName: 'obs-shared-worker.js' */)
worker.port.start()

export default worker.port
