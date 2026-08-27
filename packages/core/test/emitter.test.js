import { describe, expect, it, vi } from 'vitest'

import { Emitter } from '../src/toolkits/emitter'

describe('listening', () => {
  it('calls a listener with the payload as written, not wrapped', () => {
    // The reason this is not EventTarget: a handler should destructure the payload
    // rather than reach through `event.detail`.
    const events = new Emitter()
    const seen = vi.fn()

    events.on('goal', seen)
    events.emit('goal', { team: 'blue', scorer: 'Ada' })

    expect(seen).toHaveBeenCalledWith({ team: 'blue', scorer: 'Ada' })
  })

  it('passes several arguments through', () => {
    const events = new Emitter()
    const seen = vi.fn()

    events.on('frame', seen)
    events.emit('frame', 1, 2, 3)

    expect(seen).toHaveBeenCalledWith(1, 2, 3)
  })

  it('hands back an unsubscribe, so nothing has to keep the function around', () => {
    const events = new Emitter()
    const seen = vi.fn()

    const off = events.on('goal', seen)

    off()
    events.emit('goal', {})

    expect(seen).not.toHaveBeenCalled()
    expect(events.count('goal')).toBe(0)
  })

  it('refuses a listener that is not callable, at the point of the mistake', () => {
    expect(() => new Emitter().on('goal', 'oops')).toThrow(/needs a function/)
  })

  it('fires a `once` listener exactly once', () => {
    const events = new Emitter()
    const seen = vi.fn()

    events.once('start', seen)
    events.emit('start')
    events.emit('start')

    expect(seen).toHaveBeenCalledTimes(1)
    expect(events.count('start')).toBe(0)
  })
})

describe('a listener that misbehaves', () => {
  it('does not stop the ones after it', () => {
    // A plugin emits into a studio's own code. One author's typo must not silently
    // take the rest of a show's wiring off the air.
    const events = new Emitter()
    const after = vi.fn()
    const complain = vi.spyOn(console, 'error').mockImplementation(() => {})

    events.on('goal', () => {
      throw new Error('bad handler')
    })
    events.on('goal', after)
    events.emit('goal', { team: 'blue' })

    expect(after).toHaveBeenCalledWith({ team: 'blue' })
    expect(complain).toHaveBeenCalled()

    complain.mockRestore()
  })

  it('can unsubscribe itself mid-dispatch without skipping its neighbour', () => {
    // Iterating the live set would step over the next listener when one is removed
    // during the walk.
    const events = new Emitter()
    const second = vi.fn()

    const off = events.on('tick', () => off())

    events.on('tick', second)
    events.emit('tick')

    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe('the wildcard', () => {
  it('sees every event, named first', () => {
    const events = new Emitter()
    const seen = vi.fn()

    events.on('*', seen)
    events.emit('goal', { team: 'blue' })
    events.emit('save', { by: 'Ada' })

    expect(seen).toHaveBeenNthCalledWith(1, 'goal', { team: 'blue' })
    expect(seen).toHaveBeenNthCalledWith(2, 'save', { by: 'Ada' })
  })

  it('does not receive its own name twice over', () => {
    const events = new Emitter()
    const seen = vi.fn()

    events.on('*', seen)
    events.emit('*', 'direct')

    expect(seen).toHaveBeenCalledTimes(1)
  })
})

describe('reporting and teardown', () => {
  it('says whether anybody was listening', () => {
    const events = new Emitter()

    expect(events.emit('goal')).toBe(false)
    events.on('goal', () => {})
    expect(events.emit('goal')).toBe(true)
  })

  it('clears one event or all of them', () => {
    const events = new Emitter()

    events.on('goal', () => {})
    events.on('save', () => {})

    events.clear('goal')
    expect(events.count('goal')).toBe(0)
    expect(events.count('save')).toBe(1)

    events.clear()
    expect(events.count('save')).toBe(0)
  })
})
