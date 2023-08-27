// Import core components
// ...

class PreloadInterface {
  constructor() {
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { name: 'preload.js' } /* webpackChunkName: 'preload-worker.js' */)

    // Add the message handler
    this.worker.addEventListener('message', (response) => console.log(response))
  }

  fetch(targets) {
    this.worker.postMessage(targets)
  }
}

export default PreloadInterface
