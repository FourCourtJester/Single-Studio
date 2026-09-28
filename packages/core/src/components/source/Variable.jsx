import { useLayoutEffect, useRef, useState } from 'react'

import { useVelcroState } from '../../hooks/useVelcroValue'
import { countable, durationOf, easingOf, readNumber, writeNumber } from '../../toolkits/count'
import { cx } from '../../toolkits/cx'
import { Fit } from '../common/Fit'
import { Transition } from '../common/Transition'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

/**
 * @typedef {object} VariableProps
 * @property {string} name - Names a value under `variables` — e.g. `home.score`.
 * @property {string} [fallback] - Shown when the value is empty. Defaults to `""`.
 * @property {boolean|number} [fit] - Shrink the text to fit its box. A number caps how far.
 * @property {string} [as] - The element to render. Defaults to `"span"`, so a value can sit inside a sentence.
 * @property {string} [transition] - Motion variants, space-separated — e.g. `"slide-up ease-back"`. `"number"` counts from the old value to the new one instead. See [the transitions guide](getting-started.md#transitions).
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * One value on air, as text. This is the component most graphics are mostly made
 * of — a name, a score, a subtitle.
 *
 * Renders nothing until the path has loaded, then fades in. That matters for
 * sources set to unload when hidden: they are rebuilt from scratch every time the
 * scene returns, and painting the fallback on mount would flash "Home" on air
 * before the real name arrived. The fallback is for a path that has loaded and is
 * genuinely empty.
 *
 * @example
 * <Variable name="home.name" fallback="Home" />
 *
 * @example
 * // Shrink to fit rather than overflow a fixed box
 * <Variable name="guest.title" fallback="Guest" fit />
 *
 * @example
 * <Variable name="lowerthird.headline" fallback="" />
 *
 * @example
 * // Count from the old total to the new one rather than swapping it
 * <Variable name="donations.total" fallback="0" transition="number ease-out" />
 *
 * @param {VariableProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Variable({ name, fallback = '', fit = false, as = 'span', transition, className, ...rest }) {
  const { value, loaded } = useVelcroState(name ? `${NAMESPACE}.${name}` : undefined)
  const text = value === undefined || value === '' ? fallback : String(value)

  // `number` is a variant like any other -- it becomes `ss-number`, which is where
  // its duration and its tabular figures live -- and also a switch, because
  // counting is not something a stylesheet can do. The rest of the variants still
  // apply as classes; the easing ones are read back off the element below.
  const counting = /(^|\s)number(\s|$)/.test(transition ?? '')
  const style = useRef(null)
  const shown = useCount(text, { enabled: counting && loaded, style })

  if (!counting) {
    return (
      <Transition trigger={loaded ? text : false} transition={transition} as={as} className={cx('ss-variable', className)} {...rest}>
        {loaded ? fit ? <Fit>{text}</Fit> : text : null}
      </Transition>
    )
  }

  // The trigger holds still once the value has loaded, so Transition never runs its
  // out-swap-in: the value is not being replaced, it is travelling. Each frame is
  // then "same trigger, new children", the path a running clock already takes.
  //
  // The inner span is only there to be read. Transition does not forward its
  // element, and custom properties inherit, so this sees the variant's timing and
  // easing; `display: contents` keeps it out of the layout and out of Fit's way.
  return (
    <Transition trigger={loaded ? COUNTING : false} transition={transition} as={as} className={cx('ss-variable', className)} {...rest}>
      {loaded ? (
        <span ref={style} className="ss-count">
          {fit ? <Fit>{shown}</Fit> : shown}
        </span>
      ) : null}
    </Transition>
  )
}

/** The trigger a counting Variable holds once loaded. Not a value any store could hold. */
const COUNTING = Symbol('counting')

/**
 * The text to show while counting towards `text`.
 *
 * Four rules, each one a way a count goes wrong on air:
 *
 * - **Nothing counts on arrival.** OBS reloads browser sources constantly -- a scene
 *   switch, a source set to unload when hidden -- and a total that counts up from
 *   zero every time is a glitch the audience sees. The first value after loading is
 *   shown as it is. Only a change counts.
 * - **A change mid-count carries on from what is on screen.** Starting again from
 *   the old value would jump backwards before heading off.
 * - **Time, not frames.** A busy machine or a hidden source drops frames; progress
 *   comes from the clock, so a stalled count lands where it should have been rather
 *   than finishing late.
 * - **Anything that cannot be counted is swapped.** Text either side, or no number
 *   at all, and there is no frame in between that would read correctly.
 *
 * Reduced motion is not consulted, for the reason every other transition on a
 * graphic ignores it: the preference belongs to the operator's machine, and nobody
 * watching the stream has any say in it. See base.css.
 */
function useCount(text, { enabled, style }) {
  const [shown, setShown] = useState(text)
  // What is on screen right now, for a change that arrives mid-count.
  const current = useRef(text)
  // Whether a value has been shown since loading. Until then there is nothing to count from.
  const settled = useRef(false)

  // A layout effect, so a value that lands without counting lands before the paint
  // rather than one frame after it.
  useLayoutEffect(() => {
    const land = (next) => {
      current.current = next
      setShown(next)
    }

    if (!enabled) {
      settled.current = false
      land(text)
      return undefined
    }

    const from = readNumber(current.current)
    const to = readNumber(text)
    const computed = style.current ? window.getComputedStyle(style.current) : null
    const duration = durationOf(computed?.getPropertyValue('--ss-count-duration'))

    if (!settled.current || !countable(from, to) || from.value === to.value || !duration) {
      settled.current = true
      land(text)
      return undefined
    }

    const ease = easingOf(computed.getPropertyValue('--ss-ease'))
    const start = performance.now()
    let frame = 0

    const step = (now) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration))

      if (progress >= 1) {
        land(text)
        return
      }

      land(writeNumber(from.value + (to.value - from.value) * ease(progress), to))
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)

    return () => cancelAnimationFrame(frame)
  }, [text, enabled, style])

  // Until something has been shown, the value itself. The render in which a value
  // loads is the one Transition captures as its content, and returning the state
  // here gave it whatever was held before loading: recorded frame by frame, a source
  // with 1000 stored drew "0" first. That frame happened to be in the entering
  // phase, at zero opacity, so nobody saw it -- but it was one variant's opacity
  // rule away from being on air.
  return enabled && !settled.current ? text : shown
}
