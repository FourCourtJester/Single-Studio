import { afterEach, describe, expect, it } from 'vitest'

import * as Doc from '../src/velcro/doc'
import { createVelcroHost } from '../src/velcro/host'

// Clock skew: two machines disagreeing about what time it is.
//
// Everything in this system stores an *instant* rather than a running count, which
// is what makes clocks replicate for free -- and it is exactly why skew hurts. A
// countdown is a target epoch; if the machine that wrote it thinks it is 14:00:07
// and the machine going to air thinks it is 14:00:00, a five-minute break is five
// minutes and seven seconds on air. Nothing on screen looks wrong while it happens.
//
// The fix names one machine the reference and has everybody else add the difference
// to their own `Date.now()`. The half worth testing hardest is the *write* side:
// correcting only the display leaves the break genuinely overrunning while every
// screen agrees it is fine.

let live = []

const host = (config = {}) => {
  const made = createVelcroHost({ persist: false, ...config })

  live.push(made)

  return made
}

const client = (made) => {
  const { port1, port2 } = new MessageChannel()
  const seen = []

  port1.onmessage = ({ data }) => seen.push(data)
  port1.start()
  made.connect(port2)
  live.push({ close: () => (port1.close(), port2.close()) })

  return { port: port1, seen }
}

/** A provider's awareness, with a handle for putting other machines in the room. */
const withAwareness = (clientID = 1) => {
  const listeners = new Set()
  const states = new Map()
  const fire = () => [...listeners].forEach((fn) => fn())

  return {
    clientID,
    states,
    getStates: () => states,
    setLocalState(state) {
      if (state === null) states.delete(clientID)
      else states.set(clientID, state)

      fire()
    },
    on: (_event, fn) => listeners.add(fn),
    off: (_event, fn) => listeners.delete(fn),

    /** Another machine publishes something. */
    remote(id, state) {
      states.set(id, state)
      fire()
    },
    drop(id) {
      states.delete(id)
      fire()
    },
  }
}

const connected = (awareness, config = {}) =>
  host({ name: `clock-${Math.random()}`, sync: { url: 'memory://relay', connect: () => ({ awareness, destroy() {} }), ...config } })

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

/** One beat from a machine `skew` ahead of this one, published `age` ago. */
const beat = (awareness, id, skew, age = 0) => awareness.remote(id, { reference: true, at: Date.now() + skew - age })

/**
 * A reference machine `skew` milliseconds ahead, arriving the way a real one does.
 *
 * Two beats, because the first value a joiner reads has unknown age -- awareness
 * state persists, so it may have been written long before anybody arrived. Making
 * that opening value visibly stale is the point: measured against it this machine
 * would believe it is four seconds fast, which is a real error introduced on
 * purpose. Only the second beat, watched to arrive, can be trusted.
 */
const beats = (awareness, id, skew) => {
  beat(awareness, id, skew, 4000)
  beat(awareness, id, skew)
}

afterEach(() => {
  for (const made of live) made.close?.()
  live = []
})

describe('finding the room clock', () => {
  it('measures how far this machine is from the reference', async () => {
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    await settle()

    expect(made.sync.offset).toBe(0)

    beats(awareness, 2, 7000)

    expect(made.sync.offset).toBeGreaterThan(6800)
    expect(made.sync.offset).toBeLessThan(7200)
  })

  it('ignores the first value it sees, because it may have been written long ago', async () => {
    // The failure this prevents: a machine joining an established room reads the
    // reference's last published beat -- which could be four seconds old -- and
    // concludes it is four seconds fast. Correcting by that would be worse than
    // not correcting at all, since it is a real error introduced on purpose.
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    await settle()

    beat(awareness, 2, 7000, 4000)

    expect(made.sync.offset).toBe(0)
  })

  it('takes no notice of a machine that has not claimed the clock', async () => {
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    await settle()

    awareness.remote(2, { name: 'Dez', at: Date.now() + 3000 })
    awareness.remote(2, { name: 'Dez', at: Date.now() + 7000 })

    expect(made.sync.offset).toBe(0)
    expect(made.sync.following).toBe(null)
  })

  it('never corrects itself when it is the reference', async () => {
    // Somebody who has ticked the box on two machines has a misconfiguration, not
    // a fault. The one going to air is right by definition and must not start
    // chasing the other one.
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    made.sync.clock(true)
    await settle()

    beats(awareness, 2, 7000)

    expect(made.sync.offset).toBe(0)
    expect(made.sync.following).toBe(null)
  })

  it('follows the lowest client id when several machines claim it', async () => {
    // Every peer works this out identically, so a misconfigured room is at least a
    // room where everybody is wrong in the same direction. Three claimants, and the
    // lowest id arrives neither first nor last, so neither "whoever we saw first"
    // nor "whoever spoke most recently" can pass by accident.
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    await settle()

    beats(awareness, 5, 20000)
    beats(awareness, 3, 5000)
    beats(awareness, 9, 12000)

    expect(made.sync.following).toBe(3)
    expect(made.sync.offset).toBeGreaterThan(4800)
    expect(made.sync.offset).toBeLessThan(5200)
  })

  it('holds the last measurement when the reference goes quiet', async () => {
    // A machine that has dropped off has not changed what time it is. Snapping
    // every running clock back by several seconds would be a visible fault where
    // standing still is invisible.
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    await settle()

    beats(awareness, 2, 7000)

    const measured = made.sync.offset

    awareness.drop(2)

    expect(made.sync.offset).toBe(measured)
    expect(made.sync.following).toBe(null)
  })

  it('does not chase network jitter between beats', async () => {
    // Each sample carries one-way transit, which moves by tens of milliseconds. A
    // clock displayed in whole seconds that re-corrects by 40ms every five seconds
    // can land either side of a boundary and flicker.
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    await settle()

    beats(awareness, 2, 7000)

    const measured = made.sync.offset

    awareness.remote(2, { reference: true, at: Date.now() + 7040 })

    expect(made.sync.offset).toBe(measured)

    // A real move is still a real move.
    awareness.remote(2, { reference: true, at: Date.now() + 12000 })

    expect(made.sync.offset).toBeGreaterThan(11800)
  })

  it("keeps the beat out of the room's list of people", async () => {
    // The beat is machinery. A machine publishing one has not sat anybody at a
    // board, and a value that changes every five seconds must not read as somebody
    // arriving.
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    made.sync.clock(true)
    await settle()

    awareness.remote(2, { reference: true, at: Date.now() })

    expect(made.sync.peers()).toEqual([])

    made.sync.present({ name: 'Dez' })

    expect(made.sync.peers()).toEqual([{ id: 1, self: true, name: 'Dez' }])
  })

  it('publishes a beat of its own once it is the reference', async () => {
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    made.sync.clock(true)
    await settle()

    expect(awareness.states.get(1)).toMatchObject({ reference: true })
    expect(Number.isFinite(awareness.states.get(1).at)).toBe(true)

    made.sync.clock(false)

    expect(awareness.states.get(1)?.reference).toBeUndefined()
  })
})

describe("writing a clock in the room's frame", () => {
  it('starts a countdown that is the right length on the machine going to air', async () => {
    // The headline. This board's clock is seven seconds ahead of the studio's; an
    // operator asks for five minutes. Stored against this machine's `Date.now()`
    // the target lands seven seconds late in the studio, so the break overruns
    // while every screen in the building shows it counting down correctly.
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    await settle()

    beats(awareness, 2, 7000)

    const { port } = client(made)

    await settle()

    port.postMessage({ type: 'mutate', name: 'timer', payload: { 'timers.break': 300000 } })

    await settle()

    const timer = Doc.read(made.doc, 'timers.break')
    const studioNow = Date.now() + 7000
    const remaining = timer.ts - studioNow

    expect(remaining).toBeGreaterThan(299500)
    expect(remaining).toBeLessThan(300500)
  })

  it('starts a stopwatch from an origin the studio agrees with', async () => {
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    await settle()

    beats(awareness, 2, 7000)

    const { port } = client(made)

    await settle()

    port.postMessage({ type: 'mutate', name: 'stopwatch', payload: { 'timers.match': 'start' } })

    await settle()

    const studioNow = Date.now() + 7000
    const elapsed = studioNow - Doc.read(made.doc, 'timers.match').from

    expect(elapsed).toBeGreaterThanOrEqual(0)
    expect(elapsed).toBeLessThan(500)
  })

  it('writes against this machine when there is no reference, exactly as before', async () => {
    const made = host({ name: `alone-${Math.random()}` })
    const { port } = client(made)

    await made.started
    await settle()

    port.postMessage({ type: 'mutate', name: 'timer', payload: { 'timers.break': 300000 } })

    await settle()

    const remaining = Doc.read(made.doc, 'timers.break').ts - Date.now()

    expect(remaining).toBeGreaterThan(299500)
    expect(remaining).toBeLessThan(300500)
  })
})

describe('telling the pages', () => {
  it('sends the offset down to whoever asks for the status', async () => {
    const awareness = withAwareness()
    const made = connected(awareness)

    await made.started
    await settle()

    beats(awareness, 2, 7000)

    const { port, seen } = client(made)

    await settle()

    port.postMessage({ type: 'sync:status' })

    await settle()

    const status = seen.findLast((message) => message.type === 'sync')

    expect(status.offset).toBeGreaterThan(6800)
    expect(status.reference).toBe(false)
  })

  it('takes the clock role from a page, since the worker cannot read a URL', async () => {
    const awareness = withAwareness()
    const made = connected(awareness)
    const { port } = client(made)

    await made.started
    await settle()

    port.postMessage({ type: 'sync:clock', reference: true })

    await settle()

    expect(made.sync.snapshot.reference).toBe(true)
    expect(awareness.states.get(1)).toMatchObject({ reference: true })
  })
})
