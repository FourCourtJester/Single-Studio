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

describe('an answer that has been overtaken', () => {
  // The exact sequence caught in the browser, reduced. A page asks for the status;
  // while the answer is queued behind a backlog on the port, the truth arrives by
  // the other road and is applied. The answer then drains out describing the world
  // as it was before, and -- carrying no version -- wins.
  //
  // What made it so hard to see is that nothing is lost and nothing is late. Every
  // message arrives. The page ends up wrong because the *oldest* one spoke last, and
  // nothing asks twice, so the board stays wrong for the rest of the show.

  it('does not let a stale reply undo the newer truth that overtook it', async () => {
    const { velcro, worker, close } = clientOn()
    const saw = []

    velcro.onSyncStatus((status) => saw.push(status.delegated))
    await velcro.ready()
    await new Promise((resolve) => setTimeout(resolve, 20))

    // The truth, by the fast road.
    worker.postMessage({ type: 'sync', state: 'connected', delegated: true, seq: 43 })
    // The answer to a question asked before any of that was known, draining out of
    // the slow one. It describes version 7 of the world, so it must lose to 43.
    worker.postMessage({ type: 'sync', state: 'connected', delegated: false, seq: 7 })

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(saw.at(-1)).toBe(true)

    close()
  })

  it('still takes an answer when it is the only thing that has been said', async () => {
    // The other half: a version-stamped answer must not be mistaken for stale
    // merely because it is an answer. A page that has heard nothing has nothing to
    // rank it against, and the answer is the whole of what it knows.
    const { velcro, worker, close } = clientOn()
    const saw = []

    velcro.onSyncStatus((status) => saw.push(status.delegated))
    await velcro.ready()
    await new Promise((resolve) => setTimeout(resolve, 20))

    worker.postMessage({ type: 'sync', state: 'connected', delegated: true, seq: 0 })

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(saw.at(-1)).toBe(true)

    close()
  })
})

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
