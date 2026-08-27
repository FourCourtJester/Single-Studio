import { describe, expect, it, vi } from 'vitest'

import * as Doc from '../src/velcro/doc'
import { definePlugin, isPlugin, PluginBase } from '../src/services/plugin'
import { createVelcroHost } from '../src/velcro/host'

/** A plugin that runs nothing, so a test can drive it by hand. */
const fake = (name, hooks = {}) =>
  definePlugin({
    name,
    create: (context) => {
      const runtime = new PluginBase(name)

      runtime.context = context
      runtime.started = 0
      runtime.rechecked = 0
      runtime.start = () => {
        runtime.started += 1
        hooks.onStart?.(runtime, context)
      }
      runtime.recheck = () => {
        runtime.rechecked += 1
      }

      hooks.onCreate?.(runtime, context)

      return runtime
    },
  })

/** A host with no persistence and no sync, which is what a unit test wants. */
const host = (plugins) => createVelcroHost({ name: 'plugin-test', persist: false, plugins })

describe('declaring a plugin', () => {
  it('is recognisable, so the host can complain rather than crash', () => {
    expect(isPlugin(fake('a'))).toBe(true)
    expect(isPlugin({ name: 'a', create: () => {} })).toBe(false)
    expect(isPlugin(null)).toBe(false)
  })

  it('insists on a name and a create function at the point of the mistake', () => {
    expect(() => definePlugin({ create: () => {} })).toThrow(/needs a `name`/)
    expect(() => definePlugin({ name: 'a' })).toThrow(/needs a `create` function/)
  })
})

describe('the host starting them', () => {
  it('constructs and starts each one', async () => {
    let runtime

    const studio = host([fake('one', { onCreate: (r) => (runtime = r) })])

    await studio.started

    expect(runtime.started).toBe(1)
    expect(studio.plugins.get('one')).toBe(runtime)
  })

  it('hands over mutate, the ownership predicate, and the studio id', async () => {
    let context

    const studio = host([fake('one', { onCreate: (_r, c) => (context = c) })])

    await studio.started

    expect(context.mutate).toBeTypeOf('function')
    expect(context.owner).toBeTypeOf('function')
    expect(context.studio).toBe('plugin-test')
  })

  it('starts them only after persistence has replayed', async () => {
    // A plugin's first event can arrive immediately. If it landed before the replay,
    // IndexedDB would put the old value back on top of it.
    let startedBeforeReady = null

    const studio = createVelcroHost({
      name: 'plugin-order',
      persist: false,
      plugins: [fake('one', { onStart: () => (startedBeforeReady = false) })],
      onReady: () => {
        if (startedBeforeReady === null) startedBeforeReady = true
      },
    })

    await studio.started

    expect(startedBeforeReady).toBe(false)
  })

  it('lets a plugin write through the store like any other mutation', async () => {
    let context

    const studio = host([fake('one', { onCreate: (_r, c) => (context = c) })])

    await studio.started
    context.mutate('set', { 'variables.home.score': 3 })

    expect(Doc.read(studio.doc, 'variables.home.score')).toBe(3)
  })
})

describe('when a plugin misbehaves', () => {
  it('a broken one does not stop the others', async () => {
    // One bad dependency is not a broken show. An operator can still type a score.
    const complain = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exploding = definePlugin({
      name: 'boom',
      create: () => {
        throw new Error('nope')
      },
    })

    let good

    const studio = host([exploding, fake('fine', { onCreate: (r) => (good = r) })])

    await studio.started

    expect(good.started).toBe(1)
    expect(studio.plugins.has('boom')).toBe(false)
    expect(complain).toHaveBeenCalled()

    complain.mockRestore()
  })

  it('rejects anything that did not come from definePlugin', async () => {
    const complain = vi.spyOn(console, 'error').mockImplementation(() => {})
    const studio = host([{ name: 'raw', create: () => ({}) }])

    await studio.started

    expect(studio.plugins.size).toBe(0)
    expect(complain).toHaveBeenCalledWith(expect.stringContaining('definePlugin'), expect.anything())

    complain.mockRestore()
  })

  it('refuses a second plugin with a name already taken', async () => {
    // Two plugins under one name would make status and errors ambiguous, and the
    // second would silently never run.
    const complain = vi.spyOn(console, 'error').mockImplementation(() => {})
    const studio = host([fake('twice'), fake('twice')])

    await studio.started

    expect(studio.plugins.size).toBe(1)
    expect(complain).toHaveBeenCalledWith(expect.stringContaining('two plugins are called'))

    complain.mockRestore()
  })
})

describe('ownership', () => {
  it('is true on a studio that never joined a room', async () => {
    let context

    const studio = host([fake('one', { onCreate: (_r, c) => (context = c) })])

    await studio.started

    // A one-machine show is always its own owner. Nothing here can lock somebody
    // out of their own board.
    expect(context.owner()).toBe(true)
  })

  it('rechecks every plugin when the room status changes', async () => {
    let runtime

    // Sync has to be configured for a status to change at all: an unconfigured
    // host starts offline and stays there, and `report` swallows the no-op.
    const studio = createVelcroHost({
      name: 'plugin-status',
      persist: false,
      sync: { autoConnect: false, connect: () => ({ destroy() {} }) },
      plugins: [fake('one', { onCreate: (r) => (runtime = r) })],
    })

    await studio.started

    const before = runtime.rechecked

    await studio.sync.attach()

    // A plugin nobody rechecks keeps writing after somebody else took the OBS
    // role: two writers on the same paths, and nothing saying so.
    expect(runtime.rechecked).toBeGreaterThan(before)
  })
})

describe('the emitter a plugin carries', () => {
  it('is the seam a studio author hooks', async () => {
    const seen = vi.fn()
    let runtime

    const studio = host([fake('one', { onCreate: (r) => (runtime = r) })])

    await studio.started

    runtime.events.on('goal', seen)
    runtime.emit('goal', { team: 'blue' })

    expect(seen).toHaveBeenCalledWith({ team: 'blue' })
  })
})
