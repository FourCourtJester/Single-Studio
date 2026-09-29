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

  constructor({ config, owner, save }) {
    super('feed')

    this.config = config
    this.owner = owner
    this.save = save
  }

  #paused = false

  /**
   * The buttons, for the panel's own tests: pause and resume, never both.
   *
   * A real plugin's actions are signing in and out; this one's are chosen so the
   * suite can press one, see the other replace it, and see the notice change.
   */
  get offers() {
    return this.#paused ? ['resume'] : ['pause']
  }

  /**
   * The count, on the panel. It moves twice a second at the default rate, which is
   * what lets the suite prove an open panel keeps reading rather than showing what
   * was true when it opened.
   */
  get notice() {
    return this.#paused ? { text: `Paused from the panel at ${this.#tick} ticks.` } : { text: `${this.#tick} ticks so far.` }
  }

  act(key) {
    if (key === 'pause') {
      this.#paused = true
      clearInterval(this.#timer)
      this.#timer = null

      // Stored, not needed: it changes this plugin's saved values while the panel
      // is open, which is what a sign-in finishing does. The suite types into a
      // field first and checks the typing survives the values changing under it.
      return this.save?.({ pausedAt: this.#tick }, { restart: false })
    }

    if (key === 'resume') {
      this.#paused = false

      return this.recheck()
    }

    throw new Error(`The demo feed has no action "${key}"`)
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

    if (this.#timer || this.#paused) return

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
    summary: 'Ticks on a timer, so the plugin seam has something to exercise.',
    help: [
      { type: 'text', text: 'This one talks to nothing. It exists so the wiring can be tested without a game running.' },
      { type: 'steps', items: ['Change the name or the rate', 'Press Save and reconnect', 'Watch the count on the Match graphic follow'] },
      { type: 'note', text: 'A rate of zero is refused, because an interval that never fires looks identical to a plugin that is running fine.' },
    ],
    actions: [
      { key: 'pause', label: 'Pause' },
      { key: 'resume', label: 'Resume' },
    ],
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
