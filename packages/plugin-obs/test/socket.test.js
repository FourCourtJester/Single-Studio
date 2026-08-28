import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { obs, ObsHandler } from '../src/index'
import { authenticate, OP } from '../src/protocol'

const sockets = []

class FakeSocket {
  constructor(url) {
    this.url = url
    this.sent = []
    this.closed = false
    this.listeners = {}
    sockets.push(this)
  }

  addEventListener(type, fn) {
    ;(this.listeners[type] ??= []).push(fn)
  }

  send(text) {
    this.sent.push(JSON.parse(text))
  }

  close() {
    this.closed = true
  }

  deliver(frame) {
    for (const fn of this.listeners.message ?? []) fn({ data: JSON.stringify(frame) })
  }

  hello(authentication) {
    this.deliver({
      op: OP.HELLO,
      d: { obsStudioVersion: '30.2.2', obsWebSocketVersion: '5.5.2', rpcVersion: 1, ...(authentication ? { authentication } : {}) },
    })
  }

  identified() {
    this.deliver({ op: OP.IDENTIFIED, d: { negotiatedRpcVersion: 1 } })
  }

  /** Answer whatever request is outstanding, in OBS's shape. */
  answer(requestType, responseData, ok = true) {
    const asked = this.sent.find((frame) => frame.op === OP.REQUEST && frame.d.requestType === requestType)

    this.deliver({
      op: OP.RESPONSE,
      d: { requestType, requestId: asked?.d.requestId, requestStatus: { result: ok, code: ok ? 100 : 604 }, responseData },
    })
  }

  /** The whole opening exchange, so a test that is about something else can skip it. */
  async settle() {
    this.hello()
    this.identified()
    await Promise.resolve()
    this.answer('GetCurrentProgramScene', { currentProgramSceneName: 'Match' })
    await Promise.resolve()
    this.answer('GetStreamStatus', { outputActive: false })
    await Promise.resolve()
  }
}

/**
 * Wait for a frame to appear rather than for a length of time.
 *
 * The identify frame follows an asynchronous hash, and any fixed delay is either
 * flaky or slow. This is neither.
 */
const until = async (fn, tries = 50) => {
  for (let i = 0; i < tries; i += 1) {
    const found = fn()

    if (found) return found

    await new Promise((done) => {
      setTimeout(done, 1)
    })
  }

  return null
}

const build = (Handler = ObsHandler, over = {}) =>
  obs(Handler).create({ mutate: vi.fn(), owner: () => true, studio: 's', config: { host: 'localhost', port: 4455, password: '', events: '', ...over } })

beforeEach(() => {
  sockets.length = 0
  vi.stubGlobal('WebSocket', FakeSocket)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('connecting', () => {
  it('builds the address from the configured host and port', () => {
    build(ObsHandler, { host: '192.168.1.9', port: 4460 }).open()

    expect(sockets[0].url).toBe('ws://192.168.1.9:4460')
  })

  it('falls back to what OBS ships with', () => {
    build(ObsHandler, { host: '', port: '' }).open()

    expect(sockets[0].url).toBe('ws://localhost:4455')
  })

  it('identifies without a password when OBS does not ask for one', async () => {
    // Authentication switched off is an ordinary configuration, and sending a
    // password that was not asked for is refused.
    const plugin = build()

    plugin.open()
    sockets[0].hello()
    await Promise.resolve()

    const sent = sockets[0].sent.find((frame) => frame.op === OP.IDENTIFY)

    expect(sent.d).not.toHaveProperty('authentication')
    expect(sent.d.rpcVersion).toBe(1)
  })

  it('answers the challenge when it does', async () => {
    const plugin = build(ObsHandler, { password: 'hunter2' })

    plugin.open()
    sockets[0].hello({ challenge: 'chal', salt: 'salty' })

    // Hashing is genuinely asynchronous, so this waits for the frame rather than
    // for a guessed number of milliseconds.
    const sent = await until(() => sockets[0].sent.find((frame) => frame.op === OP.IDENTIFY))

    expect(sent.d.authentication).toBe(await authenticate('hunter2', 'salty', 'chal'))
  })

  it('says so when OBS wants a password and none is set', async () => {
    // Better than a socket that closes a moment later with nothing to read.
    const opening = build().open()

    sockets[0].hello({ challenge: 'c', salt: 's' })

    await expect(opening).rejects.toThrow(/asking for a password/)
  })

  it('subscribes only to the categories the wanted events live in', async () => {
    const plugin = build(ObsHandler, { events: 'CurrentProgramSceneChanged' })

    plugin.open()
    sockets[0].hello()
    await Promise.resolve()

    // `scenes` is 1 << 2. Asking for everything would carry events across the
    // socket for a studio to throw away.
    expect(sockets[0].sent.find((frame) => frame.op === OP.IDENTIFY).d.eventSubscriptions).toBe(4)
  })
})

describe('the present, on connect', () => {
  it('asks for the scene, because OBS announces changes and never the present', async () => {
    // Without this a studio does not know the scene until somebody changes it,
    // which on a quiet show could be the whole broadcast.
    const seen = vi.fn()

    class MyShow extends ObsHandler {
      onScene(...args) {
        seen(...args)
      }
    }

    const plugin = build(MyShow)

    plugin.open()
    await sockets[0].settle()

    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ name: 'Match' }))
  })
})

describe('requests', () => {
  it('matches a reply to its request by id, not by arrival order', async () => {
    // OBS may answer out of order, and matching on arrival attaches one reply to
    // another request's promise -- which reads as the wrong scene, silently.
    const plugin = build()

    plugin.open()
    await sockets[0].settle()

    const first = plugin.ask('GetVersion')
    const second = plugin.ask('GetSceneList')

    const ids = sockets[0].sent
      .filter((frame) => frame.op === OP.REQUEST)
      .slice(-2)
      .map((frame) => frame.d.requestId)

    // Answered backwards.
    sockets[0].deliver({ op: OP.RESPONSE, d: { requestId: ids[1], requestStatus: { result: true }, responseData: { scenes: [] } } })
    sockets[0].deliver({ op: OP.RESPONSE, d: { requestId: ids[0], requestStatus: { result: true }, responseData: { obsVersion: '30.2.2' } } })

    expect((await first).data).toEqual({ obsVersion: '30.2.2' })
    expect((await second).data).toEqual({ scenes: [] })
  })

  it('reports a refusal with the comment rather than hanging', async () => {
    const plugin = build()

    plugin.open()
    await sockets[0].settle()

    const asking = plugin.ask('SetCurrentProgramScene', { sceneName: 'Nope' })
    const id = sockets[0].sent.at(-1).d.requestId

    sockets[0].deliver({ op: OP.RESPONSE, d: { requestId: id, requestStatus: { result: false, code: 600, comment: 'No scene by that name.' } } })

    expect(await asking).toMatchObject({ ok: false, reason: 'No scene by that name.' })
  })
})

describe('events', () => {
  it('reach the studio handler in the plugin’s shape', async () => {
    const seen = vi.fn()

    class MyShow extends ObsHandler {
      onStream(...args) {
        seen(...args)
      }
    }

    const plugin = build(MyShow)

    plugin.open()
    await sockets[0].settle()
    seen.mockClear()

    sockets[0].deliver({
      op: OP.EVENT,
      d: { eventType: 'StreamStateChanged', eventData: { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' } },
    })

    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ live: true, state: 'started' }))
  })
})

describe('telling OBS to do something', () => {
  /** Connected, identified, and with the connect-time reads already out of the way. */
  const talking = async (over = {}) => {
    const plugin = build(ObsHandler, over)

    plugin.open()
    await sockets[0].settle()
    sockets[0].sent.length = 0

    return plugin
  }

  it('cuts to a scene, in obs-websocket’s own shape', async () => {
    const plugin = await talking()

    expect(plugin.command('scene', { name: 'Match' })).toBe(true)

    const [frame] = sockets[0].sent

    expect(frame.op).toBe(OP.REQUEST)
    expect(frame.d.requestType).toBe('SetCurrentProgramScene')
    expect(frame.d.requestData).toEqual({ sceneName: 'Match' })
  })

  it('turns the stream and the recorder on and off with one command each', async () => {
    const plugin = await talking()

    plugin.command('stream', { on: true })
    plugin.command('record', { on: false })

    expect(sockets[0].sent.map((frame) => frame.d.requestType)).toEqual(['StartStream', 'StopRecord'])
  })

  it('shows and hides one source inside a scene', async () => {
    const plugin = await talking()

    plugin.command('item', { scene: 'Match', id: 7, visible: false })

    expect(sockets[0].sent[0].d.requestData).toEqual({ sceneName: 'Match', sceneItemId: 7, sceneItemEnabled: false })
  })

  it('refuses a request that is not on the list', async () => {
    // The list is small on purpose: the things a show does to itself while it is
    // running, not the hundred that configure OBS at build time.
    const plugin = await talking()

    expect(() => plugin.command('CreateScene', { name: 'nope' })).toThrow(/no command "CreateScene"/)
  })

  it('says nothing on a machine that is not running this OBS', async () => {
    const plugin = await talking({})

    plugin.owner = () => false

    expect(plugin.command('scene', { name: 'Match' })).toBe(false)
    expect(sockets[0].sent).toEqual([])
  })
})
