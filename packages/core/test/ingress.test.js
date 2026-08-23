import { describe, expect, it } from 'vitest'

import { Service } from '../src/services/Service'

// Ownership of a third-party feed, which is the part of ingress that cannot be
// caught by testing alone -- and testing alone is exactly how a studio is built.
//
// One worker per machine handles the several-tabs problem. These cover the other
// one: several machines in a room, all of them holding the same studio, only one
// of them entitled to talk to anybody's API.

class Poller extends Service {
  static serviceName = 'poller'

  polls = 0

  async open() {
    this.polls += 1
  }
}

/** What createVelcroHost hands `onReady`, over a sync seam we can steer. */
const hostOwns = (sync) => () => !sync.delegated

describe('who talks to the outside world', () => {
  it('is this machine when the studio never joined a room', async () => {
    const sync = { delegated: false }
    const service = new Poller({ mutate: () => {}, owner: hostOwns(sync) })

    await service.start()

    expect(service.status).toBe('connected')
    expect(service.polls).toBe(1)
  })

  it('stands down once another machine claims the OBS role', async () => {
    const sync = { delegated: false }
    const service = new Poller({ mutate: () => {}, owner: hostOwns(sync) })

    await service.start()
    expect(service.polls).toBe(1)

    // Somebody else ticks "This machine runs OBS".
    sync.delegated = true
    await service.recheck()

    expect(service.status).toBe('delegated')
    expect(service.polls).toBe(1)
  })

  it('picks the role back up when that machine leaves', async () => {
    const sync = { delegated: true }
    const service = new Poller({ mutate: () => {}, owner: hostOwns(sync) })

    await service.start()
    expect(service.polls).toBe(0)

    sync.delegated = false
    await service.recheck()

    expect(service.status).toBe('connected')
    expect(service.polls).toBe(1)
  })

  it('asks again every time rather than answering from when it was built', async () => {
    // A service is constructed as the page loads and the room is joined a moment
    // later. An owner captured at construction would be answering a question
    // nobody had asked yet, and would keep answering it all show.
    const sync = { delegated: true }
    const service = new Poller({ mutate: () => {}, owner: hostOwns(sync) })

    expect(service.owns).toBe(false)

    sync.delegated = false

    expect(service.owns).toBe(true)
  })

  it('is its own owner by default, so nothing can lock a studio out of its board', () => {
    const service = new Poller({ mutate: () => {} })

    expect(service.owns).toBe(true)
  })
})
