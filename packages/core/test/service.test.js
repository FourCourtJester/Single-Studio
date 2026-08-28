import { describe, expect, it, vi } from 'vitest'

import { Service } from '../src/services/Service'

// Ingress ownership. Not a permission model -- a quota and a race.
//
// Five operators each polling the same Google Sheet is five times the API quota
// and five writers on the same paths, and the answer is the same one the image
// library reaches: the machine that has to display the show is the machine that
// talks to the outside world. Everybody else consumes the replicated result.

class Fake extends Service {
  static serviceName = 'fake'

  opened = 0

  closed = 0

  fail = false

  async open() {
    this.opened += 1

    if (this.fail) throw new Error('nope')
  }

  async close() {
    this.closed += 1
  }
}

const service = (options = {}) => new Fake({ mutate: () => {}, ...options })

describe('a service that owns its ingress', () => {
  it('opens a connection', async () => {
    const made = service()

    await made.start()

    expect(made.opened).toBe(1)
    expect(made.status).toBe('connected')
  })

  it('owns by default, so a studio with no collaboration is unaffected', () => {
    expect(service().owns).toBe(true)
  })
})

describe('what it says when it cannot connect', () => {
  it('keeps the reason, not only the fact', async () => {
    // `status` is a red light. This is the sentence beside it -- and without it the
    // reason lives in a console inside a SharedWorker, which is nowhere.
    const service = new Fake({ mutate: vi.fn() })

    service.fail = true
    await service.start()

    expect(service.status).toBe('error')
    expect(service.problem).toBe('nope')

    await service.stop()
  })

  it('forgets it once it connects', async () => {
    const service = new Fake({ mutate: vi.fn() })

    service.fail = true
    await service.start()
    expect(service.problem).toBe('nope')

    service.fail = false
    await service.start()

    expect(service.status).toBe('connected')
    expect(service.problem).toBeNull()

    await service.stop()
  })

  it('says nothing at all while it is fine', async () => {
    const service = new Fake({ mutate: vi.fn() })

    await service.start()

    expect(service.problem).toBeNull()

    await service.stop()
  })
})

describe('a service that does not', () => {
  it('never opens a connection at all', async () => {
    const made = service({ owner: false })

    await made.start()

    expect(made.opened).toBe(0)
    expect(made.status).toBe('delegated')
  })

  it('reads a predicate rather than a value captured at construction', async () => {
    // The ordering this exists for: a service is built when the page loads and the
    // room is joined a moment later. A boolean read once is answering a question
    // nobody had asked yet.
    let delegated = true
    const made = service({ owner: () => !delegated })

    await made.start()

    expect(made.status).toBe('delegated')

    delegated = false

    await made.recheck()

    expect(made.opened).toBe(1)
    expect(made.status).toBe('connected')
  })

  it('stands down when another machine takes the role mid-show', async () => {
    let delegated = false
    const made = service({ owner: () => !delegated })

    await made.start()

    expect(made.status).toBe('connected')

    delegated = true

    await made.recheck()

    expect(made.closed).toBe(1)
    expect(made.status).toBe('delegated')
  })

  it('does not reopen on a recheck it is already running', async () => {
    // Wired to every status change, so it is called far more often than the answer
    // changes. Reopening a live socket on each one would be a reconnect storm.
    const made = service()

    await made.start()
    await made.recheck()
    await made.recheck()

    expect(made.opened).toBe(1)
    expect(made.closed).toBe(0)
  })

  it('does not come back up on a retry it no longer owns', async () => {
    // A service backing off for half a minute can lose the role while it waits. It
    // must not wake up and start writing over the machine that took over.
    vi.useFakeTimers()

    const noise = vi.spyOn(console, 'warn').mockImplementation(() => {})

    let delegated = false
    const made = service({ owner: () => !delegated })

    made.fail = true
    await made.start()

    expect(made.status).toBe('error')

    delegated = true
    made.fail = false

    await vi.advanceTimersByTimeAsync(1000)

    expect(made.opened).toBe(1)
    expect(made.status).toBe('delegated')

    noise.mockRestore()
    vi.useRealTimers()
  })

  it('keeps retrying while it still owns the role', async () => {
    vi.useFakeTimers()

    const noise = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const made = service()

    made.fail = true
    await made.start()

    made.fail = false
    await vi.advanceTimersByTimeAsync(1000)

    expect(made.opened).toBe(2)
    expect(made.status).toBe('connected')

    noise.mockRestore()
    vi.useRealTimers()
  })
})
