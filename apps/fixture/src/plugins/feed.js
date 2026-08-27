import { definePlugin, PluginBase, PluginHandler } from '@single-studio/core/worker'

// A plugin that talks to nothing.
//
// The fixture is the test rig, and the thing worth testing here is the seam rather
// than any particular game: that a plugin is constructed with its stored config,
// that an operator can change that config from the board and see the plugin come
// back on the new value, and that events reach a handler which writes through the
// ordinary mutation path.
//
// So this emits on a timer instead of opening a socket. A real feed would extend
// `Service` and get reconnection and backoff for free; the shape a studio author
// sees is identical either way, which is the point.

class Feed extends PluginBase {
  #timer = null

  #tick = 0

  constructor({ config, owner }) {
    super('feed')

    this.config = config
    this.owner = owner
  }

  start() {
    // Refused rather than silently accepted: a rate of zero is an interval that
    // never fires, and "it is running but nothing happens" is the worst way to
    // find out you typed the wrong number.
    if (!Number(this.config.rate)) throw new Error('Ticks per minute must be more than zero.')

    return this.recheck()
  }

  recheck() {
    // Only the machine that owns ingress runs the timer. Everyone else reads the
    // replicated result, which is the same show a moment later and none of the cost.
    if (!this.owner?.()) {
      this.stop()
      this.status = 'delegated'

      return
    }

    if (this.#timer) return

    this.status = 'connected'
    this.#timer = setInterval(
      () => {
        this.#tick += 1
        this.emit('tick', { count: this.#tick, label: this.config.label })
      },
      60_000 / Number(this.config.rate),
    )
  }

  stop() {
    clearInterval(this.#timer)
    this.#timer = null
    this.status = 'idle'
  }
}

/** The skeleton a studio fills in. One method per event, all no-ops. */
export class FeedHandler extends PluginHandler {
  static handles = { tick: 'onTick' }

  onTick() {}
}

export const feed = (Handler = FeedHandler) =>
  definePlugin({
    name: 'feed',
    label: 'Demo feed',
    config: [
      { key: 'label', label: 'What to call it', default: 'Feed', help: 'Written to the scene beside the count.' },
      { key: 'rate', label: 'Ticks per minute', type: 'number', default: 120 },
    ],
    create: (context) => {
      const plugin = new Feed(context)

      new Handler({ ...context, plugin }).attach(plugin.events)

      return plugin
    },
  })
