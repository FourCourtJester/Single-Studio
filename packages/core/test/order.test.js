import { describe, expect, it } from 'vitest'

import { createVelcroClient } from '../src/velcro/client'

// The client's ordering rule on its own, driven directly: a late copy of an older
// value must not undo a newer one. Reproduced here rather than through a host,
// because the whole point is delivery arriving in an order a host would never send.

const clientOn = () => {
  const { port1, port2 } = new MessageChannel()

  port2.onmessage = ({ data }) => {
    if (data?.type === 'hello') port2.postMessage({ type: 'ready', name: 'ordering', ready: true })
  }
  port2.start()

  const velcro = createVelcroClient({ name: 'ordering', worker: () => ({ port: port1 }) })

  return { velcro, worker: port2, close: () => (port1.close(), port2.close()) }
}

describe('a page told things out of order', () => {
  it('keeps the newest value when an older copy turns up late', async () => {
    const { velcro, worker, close } = clientOn()
    const saw = []

    velcro.subscribe('variables.home.score', (value) => saw.push(value))
    await velcro.ready()
    await new Promise((resolve) => setTimeout(resolve, 20))

    worker.postMessage({ type: 'value', path: 'variables.home.score', value: 1, seq: 1 })
    worker.postMessage({ type: 'value', path: 'variables.home.score', value: 2, seq: 2 })
    // The straggler: the same older value, arriving by the slower road.
    worker.postMessage({ type: 'value', path: 'variables.home.score', value: 1, seq: 1 })

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(saw.at(-1)).toBe(2)

    close()
  })
})
