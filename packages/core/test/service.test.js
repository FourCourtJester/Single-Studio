import { describe, expect, it, vi } from 'vitest'

import { Service } from '../src/services/Service'
import { SocketService } from '../src/services/SocketService'

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

describe('a connection that is accepted and then abandoned', () => {
  /**
   * The one shape the retry never saw.
   *
   * A refused connection fires `error`, rejects `open()`, and `start()` backs off --
   * that path was always right. A socket that is *accepted and then abandoned*
   * fires neither `open` nor `error`, so `open()` settled neither way and the retry
   * that exists for exactly this never ran. Found on a real machine, where an editor
   * was forwarding the game's port into a container with nothing listening: it bound
   * loopback, accepted, and had nowhere to hand the connection on to.
   *
   * See docs/internal/host-hang.md.
   */
  class Silent extends SocketService {
    static serviceName = 'silent'

    get url() {
      return 'ws://127.0.0.1:1'
    }

    attempts = 0

    // Accepts, then nothing. No open, no error, no close.
    connect() {
      this.attempts += 1

      return { addEventListener() {}, close() {} }
    }
  }

  const silent = (over = {}) => Object.assign(new Silent({ mutate: () => {} }), over)

  it('gives up on the handshake rather than waiting for the length of the show', async () => {
    vi.useFakeTimers()

    try {
      const made = silent()
      const started = made.start()

      // Still trying, for as long as the budget says. Asserted on `problem` rather
      // than on `status`, because nothing sets a status during a handshake -- it
      // reads `idle` throughout, which is the same thing it read before `start` was
      // ever called and would prove nothing.
      await vi.advanceTimersByTimeAsync(9_000)
      expect(made.problem).toBe(null)

      // Just past the deadline, and not as far as the first backoff step at +500ms.
      await vi.advanceTimersByTimeAsync(1_100)
      await started

      // `error`, which is what a refused connection has always reported -- the
      // deadline puts this failure on the path that already worked rather than
      // inventing one.
      expect(made.status).toBe('error')
      expect(made.problem).toMatch(/accepted a connection and then said nothing/)
      expect(made.attempts).toBe(1)

      // And it tries again, which is the whole point. 500ms is the first backoff
      // step; before the fix there was no second attempt at all, ever.
      await vi.advanceTimersByTimeAsync(600)

      expect(made.attempts).toBe(2)

      await made.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('says which address did it, because that is the part nobody can guess', async () => {
    vi.useFakeTimers()

    try {
      const made = silent()
      const started = made.start()

      await vi.advanceTimersByTimeAsync(10_500)
      await started

      expect(made.problem).toContain('ws://127.0.0.1:1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not fire on a connection that came up', async () => {
    // The obvious way to get this wrong: a deadline that is armed and never
    // cancelled kills a perfectly healthy socket ten seconds in.
    //
    // Counted, not read off the status, because the status hides it. A deadline
    // that misfires drops the connection and the retry reconnects a beat later --
    // against a socket that works, that lands back on `connected` with `problem`
    // cleared, so the end state is identical to never having misfired. What is not
    // identical is that the show's feed went down and came back for no reason. The
    // count is the only thing that says so.
    vi.useFakeTimers()

    const made = silent()

    try {
      made.connect = () => {
        made.attempts += 1

        return { addEventListener: (type, fn) => type === 'open' && fn(), close() {} }
      }

      await made.start()
      expect(made.status).toBe('connected')

      await vi.advanceTimersByTimeAsync(30_000)

      expect(made.status).toBe('connected')
      expect(made.attempts).toBe(1)
    } finally {
      await made.stop()
      vi.useRealTimers()
    }
  })

  it('does not leave its deadline running on a service that was told to stop', async () => {
    // Asserted on the pending timer rather than on what happens later, because
    // nothing happens later: `dropped` already refuses to retry a stopped service,
    // so a deadline left armed changes no status and triggers no reconnect. What it
    // does do is hold the service, its socket and its config alive until it fires,
    // in a worker that outlives every page. The count is the only observable.
    vi.useFakeTimers()

    try {
      const made = silent()

      made.start()
      expect(vi.getTimerCount()).toBe(1)

      await made.stop()
      expect(vi.getTimerCount()).toBe(0)

      await vi.advanceTimersByTimeAsync(30_000)

      expect(made.status).toBe('idle')
      expect(made.attempts).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
