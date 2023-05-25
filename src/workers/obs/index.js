class OBSWorker {
  constructor() {
    console.log('Create OBSWorker')
    this.worker = new SharedWorker(new URL('./ws.js', import.meta.url), { name: 'obs.js' } /* webpackChunkName: 'obs-shared-worker.js' */)
    this.worker.port.start()
  }
}

export default OBSWorker

// const worker = new SharedWorker(new URL('./ws.js', import.meta.url), { name: 'obs.js' } /* webpackChunkName: 'obs-shared-worker.js' */)
// worker.port.start()

// export default worker.port
