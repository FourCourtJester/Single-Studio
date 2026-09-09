import { FakeSocket, fakeSockets } from '@single-studio/core/testing'

/** The game's own frame shape, which is the part worth being exact about. */
export class GameSocket extends FakeSocket {
  /**
   * One frame, shaped the way the game shapes it: `Data` is a JSON *string* inside
   * the JSON frame, not an object. Sending an object here is what let a
   * double-encoded payload reach a studio unparsed -- every shape read `undefined`
   * and reported zero, and the suite was perfectly happy.
   *
   * Named `frame` rather than `send`, which it used to be. `send` is the socket's
   * *outbound* method -- what `SocketService.send()` calls -- so a fake using it for
   * inbound frames was quietly unable to record anything the plugin sent. Harmless
   * only for as long as Rocket League accepts no commands, which is not a property
   * worth depending on.
   */
  frame(Event, Data) {
    this.raw(JSON.stringify({ Event, Data: JSON.stringify(Data) }))
  }
}

export const gameSockets = () => fakeSockets(GameSocket)
