import 'fake-indexeddb/auto'

import { describe, expect, it, vi } from 'vitest'

import * as Doc from '../src/velcro/doc'
import { defaultConfig, definePlugin, isPlugin, PluginBase, PluginHandler } from '../src/services/plugin'
import { createVelcroHost } from '../src/velcro/host'
import { SettingsStore } from '../src/velcro/settings'

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

/** Wait for something to become true, rather than guessing how many turns it takes. */
const until = async (predicate, why = 'condition') => {
  const deadline = Date.now() + 1_000

  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${why}`)
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
}

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

  it('does not make one slow plugin the reason the others are late', async () => {
    // A `start` is a handshake with somebody else's software, and one that is
    // switched off does not answer quickly -- it does not answer at all until the
    // browser gives up. Started in a row, that plugin decides when every plugin
    // after it may begin.
    let release
    const hanging = definePlugin({
      name: 'slow',
      create: () => {
        const runtime = new PluginBase('slow')

        runtime.start = () => new Promise((resolve) => (release = resolve))

        return runtime
      },
    })

    let quick
    let everything = false

    const studio = host([hanging, fake('quick', { onCreate: (r) => (quick = r) })])

    studio.started.then(() => {
      everything = true
    })

    // Started in a row this never arrives, because the first plugin never resolves.
    await until(() => quick?.started === 1, 'the second plugin to start')

    // And the first one really is still hanging, so this is concurrency rather
    // than the slow one having quietly finished.
    expect(everything).toBe(false)

    release()
    await studio.started
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

describe('config', () => {
  it('refuses a field with no key, or an invented type', () => {
    expect(() => definePlugin({ name: 'a', create: () => ({}), config: [{ label: 'Port' }] })).toThrow(/needs a `key`/)
    expect(() => definePlugin({ name: 'a', create: () => ({}), config: [{ key: 'port', type: 'slider' }] })).toThrow(/expected one of/)
  })

  it('falls back to a type-appropriate empty when no default is given', () => {
    expect(defaultConfig([{ key: 'port', type: 'number', default: 49122 }, { key: 'name' }, { key: 'on', type: 'boolean' }])).toEqual({
      port: 49122,
      name: '',
      on: false,
    })
  })

  it('reaches a plugin as the shipped defaults when nothing is stored', async () => {
    let seen

    const studio = createVelcroHost({
      name: `cfg-${Math.random()}`,
      persist: false,
      plugins: [
        definePlugin({
          name: 'rl',
          config: [{ key: 'port', type: 'number', default: 49122 }],
          create: (context) => {
            seen = context.config
            return new PluginBase('rl')
          },
        }),
      ],
    })

    await studio.started

    expect(seen).toEqual({ port: 49122 })
  })

  it('is stored per studio, restarts the plugin, and comes back on the next load', async () => {
    const name = `cfg-${Math.random()}`
    const ports = []

    const plugin = () =>
      definePlugin({
        name: 'rl',
        label: 'Rocket League',
        config: [{ key: 'port', type: 'number', default: 49122 }],
        create: (context) => {
          ports.push(context.config.port)
          return new PluginBase('rl')
        },
      })

    const studio = createVelcroHost({ name, persist: false, plugins: [plugin()] })

    await studio.started
    expect(await studio.configurePlugin('rl', { port: 5000 })).toEqual({ ok: true })

    // Rebuilt against the new value rather than left running on the old one: the
    // config is the address of the thing it talks to.
    expect(ports).toEqual([49122, 5000])
    expect(await new SettingsStore(name).get('plugin:rl')).toEqual({ port: 5000 })

    const again = createVelcroHost({ name, persist: false, plugins: [plugin()] })

    await again.started
    expect(ports.at(-1)).toBe(5000)
  })

  it('fills in a field added by a later version of a plugin', async () => {
    const name = `cfg-${Math.random()}`

    // What an operator who configured the old version has stored.
    await new SettingsStore(name).set('plugin:rl', { port: 5000 })

    let seen

    const studio = createVelcroHost({
      name,
      persist: false,
      plugins: [
        definePlugin({
          name: 'rl',
          config: [
            { key: 'port', type: 'number', default: 49122 },
            { key: 'team', default: 'blue' },
          ],
          create: (context) => {
            seen = context.config
            return new PluginBase('rl')
          },
        }),
      ],
    })

    await studio.started

    expect(seen).toEqual({ port: 5000, team: 'blue' })
  })

  it('says so rather than throwing when asked about a plugin that is not installed', async () => {
    const studio = createVelcroHost({ name: `cfg-${Math.random()}`, persist: false, plugins: [] })

    await studio.started

    expect(await studio.configurePlugin('nope', {})).toMatchObject({ ok: false })
  })
})

describe('the manifest a board reads', () => {
  it('carries what to render and what it is set to', async () => {
    const studio = createVelcroHost({
      name: `man-${Math.random()}`,
      persist: false,
      plugins: [
        definePlugin({
          name: 'rl',
          label: 'Rocket League',
          summary: 'Reads the game.',
          help: [{ type: 'steps', items: ['Turn it on'] }],
          config: [{ key: 'port', type: 'number', default: 49122, label: 'Port' }],
          create: () => {
            const runtime = new PluginBase('rl')

            runtime.status = 'connected'

            return runtime
          },
        }),
      ],
    })

    await studio.started

    // The worker answers, because the worker is where plugins are declared.
    expect(await studio.pluginManifest()).toEqual([
      {
        name: 'rl',
        label: 'Rocket League',
        // Carried across postMessage so the board can render setup instructions
        // written by whoever knows how the thing works.
        summary: 'Reads the game.',
        help: [{ type: 'steps', items: ['Turn it on'] }],
        config: [{ key: 'port', type: 'number', default: 49122, label: 'Port' }],
        values: { port: 49122 },
        status: 'connected',
        // Null rather than absent, so a board can render the field unconditionally.
        problem: null,
      },
    ])
  })

  it('carries why a plugin is not connected, not only that it is not', async () => {
    // A red light saying "Not connecting" sends an operator to whoever built the
    // studio. The reason sends them to the thing that is actually wrong -- and the
    // console it would otherwise be in is inside a SharedWorker, where nobody will
    // ever look for it.
    const studio = createVelcroHost({
      name: `why-${Math.random()}`,
      persist: false,
      plugins: [
        definePlugin({
          name: 'obs',
          create: () => {
            const runtime = new PluginBase('obs')

            runtime.status = 'error'
            runtime.problem = 'Could not reach obs at ws://127.0.0.1:4455.'

            return runtime
          },
        }),
      ],
    })

    await studio.started

    const [entry] = await studio.pluginManifest()

    expect(entry.status).toBe('error')
    expect(entry.problem).toBe('Could not reach obs at ws://127.0.0.1:4455.')
  })

  it('carries why one that never started at all did not', async () => {
    // Nothing to ask on the runtime, because there is no runtime -- so the host
    // remembers on its behalf.
    const complain = vi.spyOn(console, 'error').mockImplementation(() => {})

    const studio = createVelcroHost({
      name: `why-none-${Math.random()}`,
      persist: false,
      plugins: [
        definePlugin({
          name: 'boom',
          create: () => {
            throw new Error('the port must be a number')
          },
        }),
      ],
    })

    await studio.started

    const [entry] = await studio.pluginManifest()

    expect(entry.status).toBe('idle')
    expect(entry.problem).toBe('the port must be a number')

    complain.mockRestore()
  })
})

describe('the handler a studio author fills in', () => {
  class Skeleton extends PluginHandler {
    static handles = { GoalScored: 'onGoalScored', MatchEnded: 'onMatchEnded' }

    onGoalScored() {}

    onMatchEnded() {}
  }

  it('calls only the methods that were overridden, with `this` intact', () => {
    const events = new PluginBase('rl').events
    const goals = []

    class MyShow extends Skeleton {
      constructor(context) {
        super(context)
        this.tally = 0
      }

      onGoalScored({ scorer }) {
        this.tally += 1
        goals.push(`${scorer} (${this.tally})`)
      }
    }

    const handler = new MyShow({ mutate: () => {}, owner: () => true, studio: 's' })

    handler.attach(events)

    events.emit('GoalScored', { scorer: 'Ada' })
    events.emit('GoalScored', { scorer: 'Kim' })
    events.emit('MatchEnded', {})

    // A class rather than a callback so a handler has somewhere to keep what it
    // needs between events.
    expect(goals).toEqual(['Ada (1)', 'Kim (2)'])
  })

  it('inherits the map without a subclass restating it', () => {
    const events = new PluginBase('rl').events
    const seen = vi.fn()

    class MyShow extends Skeleton {
      onMatchEnded(...args) {
        seen(...args)
      }
    }

    new MyShow({ mutate: () => {} }).attach(events)
    events.emit('MatchEnded', { WinnerTeamNum: 0 })

    expect(seen).toHaveBeenCalledWith({ WinnerTeamNum: 0 })
  })

  it('detaches everything at once', () => {
    const events = new PluginBase('rl').events
    const seen = vi.fn()

    class MyShow extends Skeleton {
      onGoalScored(...args) {
        seen(...args)
      }
    }

    const off = new MyShow({ mutate: () => {} }).attach(events)

    off()
    events.emit('GoalScored', {})

    expect(seen).not.toHaveBeenCalled()
    expect(events.count('GoalScored')).toBe(0)
  })

  it('warns about a mapping that points at nothing rather than failing silently', () => {
    const complain = vi.spyOn(console, 'warn').mockImplementation(() => {})

    class Broken extends PluginHandler {
      static handles = { GoalScored: 'onGaolScored' }
    }

    new Broken({ mutate: () => {} }).attach(new PluginBase('rl').events)

    expect(complain).toHaveBeenCalledWith(expect.stringContaining('onGaolScored'))

    complain.mockRestore()
  })
})

describe('help', () => {
  it('defaults to nothing, so a plugin need not have any', () => {
    const definition = definePlugin({ name: 'plain', create: () => ({}) })

    expect(definition.help).toEqual([])
    expect(definition.summary).toBe('')
  })

  it('refuses a block type the board cannot render', () => {
    // Caught where the mistake is, rather than rendering nothing on a board at
    // five to seven.
    expect(() => definePlugin({ name: 'a', create: () => ({}), help: [{ type: 'video', src: 'x' }] })).toThrow(/expected one of/)
    expect(() => definePlugin({ name: 'a', create: () => ({}), help: [{ text: 'no type' }] })).toThrow(/expected one of/)
  })

  it('insists it is a list', () => {
    expect(() => definePlugin({ name: 'a', create: () => ({}), help: 'just a string' })).toThrow(/must be an array/)
  })

  it('takes the blocks a plugin author actually needs', () => {
    const help = [
      { type: 'text', text: 'What this is' },
      { type: 'steps', items: ['One', 'Two'] },
      { type: 'code', text: 'scopes here' },
      { type: 'link', href: 'https://example.com', label: 'The console' },
      { type: 'note', text: 'Mind this' },
    ]

    expect(definePlugin({ name: 'a', create: () => ({}), help }).help).toEqual(help)
  })

  it('survives the trip a manifest makes', () => {
    // The whole constraint on the format: it crosses postMessage, so it has to be
    // structured clone-able. A React element would not be.
    const help = [{ type: 'steps', items: ['One'] }]

    expect(JSON.parse(JSON.stringify(help))).toEqual(help)
  })
})
