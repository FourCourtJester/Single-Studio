// A small event emitter, because a plugin's entire contract is events.
//
// Deliberately not a dependency. Every studio inherits what this package installs,
// and an emitter is thirty lines -- the same argument the icon set makes.
//
// Deliberately not EventTarget either, which is available in a worker and would
// have cost nothing to use. It wraps every payload in a CustomEvent, so a handler
// reads `event.detail.team` rather than `{ team }`, and a plugin author writing
// `rl.on('goal', ({ team }) => ...)` is the ergonomics this exists for.

/**
 * @template {Record<string, unknown[]>} [Events=Record<string, unknown[]>]
 */
export class Emitter {
  /** @type {Map<string, Set<Function>>} */
  #listeners = new Map()

  /**
   * Listen. Returns the unsubscribe, so a caller never has to keep the function
   * around to take it off again.
   *
   * @param {string} event
   * @param {(...args: any[]) => void} listener
   * @returns {() => void}
   */
  on(event, listener) {
    if (typeof listener !== 'function') throw new TypeError(`on('${event}') needs a function`)

    const set = this.#listeners.get(event) ?? new Set()

    this.#listeners.set(event, set)
    set.add(listener)

    return () => this.off(event, listener)
  }

  /**
   * Listen for the next one only.
   *
   * @param {string} event
   * @param {(...args: any[]) => void} listener
   * @returns {() => void}
   */
  once(event, listener) {
    const off = this.on(event, (...args) => {
      off()
      listener(...args)
    })

    return off
  }

  /**
   * @param {string} event
   * @param {(...args: any[]) => void} listener
   */
  off(event, listener) {
    const set = this.#listeners.get(event)

    if (!set) return

    set.delete(listener)

    if (!set.size) this.#listeners.delete(event)
  }

  /**
   * Emit to everybody listening for `event`, and to anybody listening for `'*'`.
   *
   * A listener that throws is reported and skipped rather than allowed to stop the
   * ones after it. A plugin emits into code it does not control -- a studio's own
   * handler -- and one author's typo should not silently take the rest of a show's
   * wiring off the air.
   *
   * Iterated over a copy, so a handler that unsubscribes itself (or another) during
   * dispatch does not change the set being walked.
   *
   * @param {string} event
   * @param {...unknown} args
   * @returns {boolean} Whether anybody was listening.
   */
  emit(event, ...args) {
    const direct = this.#listeners.get(event)
    const any = event === '*' ? null : this.#listeners.get('*')

    for (const listener of direct ? [...direct] : []) {
      try {
        listener(...args)
      } catch (error) {
        console.error(`[emitter] a listener for "${event}" threw`, error)
      }
    }

    for (const listener of any ? [...any] : []) {
      try {
        listener(event, ...args)
      } catch (error) {
        console.error('[emitter] a wildcard listener threw', error)
      }
    }

    return Boolean(direct?.size)
  }

  /** How many listeners `event` has. Mostly for tests and teardown assertions. */
  count(event) {
    return this.#listeners.get(event)?.size ?? 0
  }

  /** Forget everything, or everything for one event. Used when a plugin stops. */
  clear(event) {
    if (event === undefined) this.#listeners.clear()
    else this.#listeners.delete(event)
  }
}
