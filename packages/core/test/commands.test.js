import { describe, expect, it, vi } from 'vitest'

import { PluginHandler } from '../src/services/plugin'
import { SocketService } from '../src/services/SocketService'

// The other direction.
//
// A plugin that only reads is half a plugin: a studio that knows the round started
// usually wants to *do* something about it in the thing that told it. This needs no
// routing and no new mechanism, because the event arrived on the machine running the
// game and the answer goes back down the socket it came in on -- which is why it
// exists while the remote-operator version is still deferred.
//
// What is worth testing is not the sending. It is the three refusals.

class FakeSocket {
  sent = []

  addEventListener() {}

  close() {}

  send(frame) {
    this.sent.push(JSON.parse(frame))
  }
}

class Game extends SocketService {
  static serviceName = 'game'

  static commands = {
    hud: ({ visible }) => ({ Command: 'SetHud', Data: { visible: Boolean(visible) } }),
    seek: ({ to }) => ({ Command: 'Seek', Data: { seconds: to } }),
  }

  socketForTest = new FakeSocket()

  get url() {
    return 'ws://127.0.0.1:1'
  }

  connect() {
    return this.socketForTest
  }

  async receive() {}
}

const live = (over = {}) => {
  const service = new Game({ mutate: vi.fn(), ...over })

  service.open()

  return service
}

describe('sending a command', () => {
  it('builds the frame the plugin declared', () => {
    const game = live()

    expect(game.command('hud', { visible: false })).toBe(true)
    expect(game.socketForTest.sent).toEqual([{ Command: 'SetHud', Data: { visible: false } }])
  })

  it('sends more than one, in order', () => {
    const game = live()

    game.command('hud', { visible: true })
    game.command('seek', { to: 42 })

    expect(game.socketForTest.sent.map((frame) => frame.Command)).toEqual(['SetHud', 'Seek'])
  })
})

describe('what it refuses, and how', () => {
  it('throws on a name that does not exist, and says what does', () => {
    // A typo in a studio's own code. It will never work, and the far end would
    // swallow the frame without a word -- so this is loud, at the moment it is
    // written, rather than silent on air.
    const game = live()

    expect(() => game.command('hde', { visible: false })).toThrow(/no command "hde".*accepts hud, seek/s)
  })

  it('says so plainly when a plugin declares no commands at all', () => {
    class Quiet extends SocketService {
      static serviceName = 'quiet'

      get url() {
        return 'ws://127.0.0.1:1'
      }
    }

    const quiet = new Quiet({ mutate: vi.fn() })

    expect(() => quiet.command('anything')).toThrow(/accepts none yet/)
  })

  it('returns false, quietly, on a machine that does not own the role', () => {
    // The normal state of every machine but one on a collaborating show, several
    // times a match. Throwing would mean every handler wrapping every command in
    // the same guard, and the first author to forget fills a colleague's console
    // during a show.
    const game = live({ owner: () => false })

    expect(game.command('hud', { visible: false })).toBe(false)
    expect(game.socketForTest.sent).toEqual([])
  })

  it('returns false when there is nothing connected yet', () => {
    // The game is not running, or is still starting. A handler should not have to
    // check, and an unsent command is the right outcome rather than an error.
    const game = new Game({ mutate: vi.fn() })

    expect(game.command('hud', { visible: false })).toBe(false)
  })

  it('is refused after close, rather than writing to a dead socket', () => {
    const game = live()

    game.close()

    expect(game.command('hud', { visible: false })).toBe(false)
  })
})

describe('the handler shorthand', () => {
  it('reaches the plugin, so a studio writes this.command()', () => {
    const game = live()

    class MyShow extends PluginHandler {
      static handles = { roundStarted: 'onRoundStarted' }

      onRoundStarted() {
        this.command('hud', { visible: false })
      }
    }

    new MyShow({ mutate: vi.fn(), plugin: game }).attach(game.events)

    game.emit('roundStarted', {})

    expect(game.socketForTest.sent).toEqual([{ Command: 'SetHud', Data: { visible: false } }])
  })

  it('says so when the plugin behind it does not take commands', () => {
    // A polling plugin, or anything that is not a socket. Better than a crash
    // inside somebody else's package.
    class MyShow extends PluginHandler {}

    const handler = new MyShow({ mutate: vi.fn(), plugin: { name: 'sheets' } })

    expect(() => handler.command('anything')).toThrow(/sheets does not take commands/)
  })
})
