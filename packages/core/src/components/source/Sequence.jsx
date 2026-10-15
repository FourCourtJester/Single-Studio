import { Children, createContext, isValidElement, useContext, useEffect, useState } from 'react'

import { useClockOffset } from '../../hooks/useSync'
import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { cueAt } from '../../toolkits/sequence'
import { Transition } from '../common/Transition'

/** Where a starting toggle lives. Not a prop: a studio never needs another. */
const NAMESPACE = 'toggles'

/** Whether this item is the one on screen, and the motion it falls back to. */
const Current = createContext({ on: false, transition: 'fade' })

/**
 * The time since a sequence started, as the arithmetic wants it.
 *
 * Two clocks, deliberately. A free-running sequence is timed from the room's epoch
 * so that every output, on every machine, lands on the same item -- that needs the
 * room's time. A toggle-started one is timed from the moment *this page* saw the
 * toggle go on, which is a reading of this machine's clock, so it is measured
 * against the same clock: adding the room's offset to one end and not the other
 * would jump the sequence by the offset the moment the sync layer reported it.
 */
function elapsedSince(begin, offset) {
  return Date.now() + offset - begin
}

/**
 * @typedef {object} SequenceProps
 * @property {string} [toggle] - Names a toggle under `toggles` — e.g. `intro`. Plays from the first item when it goes on, and takes the sequence off when it goes off. Without one, the sequence loops forever.
 * @property {number} [duration] - Seconds an item without a `duration` of its own is the current one. Defaults to `8`.
 * @property {boolean} [loop] - Go round again after the last item. `false` holds the last one until the toggle goes off. Defaults to `true`.
 * @property {string} [transition] - Motion variants for every item without a `transition` of its own — e.g. `"slide-up ease-back"`. Defaults to `"fade"`.
 * @property {import("react").ReactNode} [children] - `SequenceItem`s, or anything else, which is treated as an item with the defaults.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Slides of anything, one at a time, each on screen for as long as it says. A
 * `Slideshow` whose slides are whatever you put in them.
 *
 *   <Sequence>
 *     <SequenceItem duration={10}><Variable name="sponsor" /></SequenceItem>
 *     <SequenceItem duration={8}><Clock /></SequenceItem>
 *   </Sequence>
 *
 * **A duration is the time an item is the current one** -- from the moment it starts
 * coming in to the moment it starts going out. Its exit is not counted, because it
 * plays while the next item is already coming in, which makes the default a
 * cross-fade. To have one leave before the next arrives, delay the entrance in CSS:
 * `.ss-sequence-item.ss-active { transition-delay: 300ms }`. Timing for the motion
 * stays in the stylesheet, as it does for every `transition`.
 *
 * **Without a `toggle` it is decided by the clock, not a timer**, as a `Slideshow`
 * is: every output shows the same item at the same moment, having agreed with
 * nobody, and a browser source reopened mid-show comes back on the right one.
 *
 * **With a `toggle` it follows one**, playing from the first item when it goes
 * on. Each output times it from when that output saw the toggle change, so outputs
 * open at the time play together -- but one opened or reloaded afterwards starts
 * again from the first item. See docs/internal/sequence.md for what would fix that.
 *
 * Items are stacked in one place, so the sequence is the size of its largest item
 * and does not move as it plays. Everything stays mounted while it is off, as a
 * `Toggle`'s children do: a clock in an item that comes round once a minute shows
 * the right time when it arrives.
 *
 * Items have to be its direct children, because it reads `duration` off them. One
 * inside a component of your own, or a fragment, counts as a single item with the
 * defaults. Leave an item out only on a shared value: it changes the length of the
 * loop, and a page that disagrees with the others about it drifts from them.
 *
 * @example
 * // The corner of a broadcast, forever
 * <Sequence transition="slide-up">
 *   <SequenceItem duration={12}><Variable name="sponsor.line" /></SequenceItem>
 *   <SequenceItem duration={8}>
 *     <div className="flex gap-2"><Image name="logo" alt="" /><Clock /></div>
 *   </SequenceItem>
 *   <SequenceItem duration={15}><Timer name="break" /></SequenceItem>
 * </Sequence>
 *
 * @example
 * // Once through when the operator presses Show intro, holding on the last
 * <Sequence toggle="intro" loop={false} duration={4}>
 *   <Image name="event.logo" alt="" />
 *   <Variable name="home.name" />
 *   <Variable name="away.name" />
 * </Sequence>
 *
 * @param {SequenceProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Sequence({ toggle, duration = 8, loop = true, transition = 'fade', className, children, ...rest }) {
  const { value, loaded } = useVelcroState(toggle ? `${NAMESPACE}.${toggle}` : undefined)
  const offset = useClockOffset()

  // Hidden until the toggle has loaded, so a source rebuilt mid-show never plays
  // its first item before finding out it was supposed to be off.
  const on = loaded && Boolean(value)

  const items = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => (child.type === SequenceItem ? child : <SequenceItem key={child.key}>{child}</SequenceItem>))

  // An item's own `duration` defaults to NaN, which means "the sequence's". Read off
  // its props here, where SequenceItem's own default never applies, so an absent one
  // is NaN too. A string, so the effect below sees a change in what the durations
  // are rather than a new array every render.
  const durations = items
    .map((item) => {
      const own = Number(item.props.duration ?? NaN)

      return (Number.isNaN(own) ? duration : own) * 1000
    })
    .join(',')

  // When a toggle-started sequence began, on this machine's clock. Kept across
  // renders while the toggle stays on, and forgotten when it goes off, so turning it
  // on again plays from the top.
  const [started, setStarted] = useState(null)

  useEffect(() => {
    if (toggle) setStarted((was) => (on ? (was ?? Date.now()) : null))
  }, [toggle, on])

  const begin = toggle ? started : 0
  const clock = toggle ? 0 : offset

  const cue = () => cueAt({ elapsed: elapsedSince(begin, clock), durations: durations ? durations.split(',').map(Number) : [], loop })

  const [index, setIndex] = useState(() => (begin === null ? -1 : cue().index))

  // Bumped by the boundary timer, so the effect runs again even when the timer fired
  // a moment early and the arithmetic still says the same item. Setting the index
  // alone would not: an unchanged value is not a render, the effect would not run,
  // and nothing would ever be scheduled again.
  const [wake, setWake] = useState(0)

  useEffect(() => {
    if (begin === null) {
      setIndex(-1)

      return undefined
    }

    // Read off the clock every time, never stepped on from the last item: a tab
    // that was throttled in the background, or a machine whose offset has just
    // been corrected, lands on the right item rather than the next one in line.
    const now = cue()

    setIndex(now.index)

    if (!Number.isFinite(now.until)) return undefined

    const timer = setTimeout(() => setWake((n) => n + 1), Math.max(50, now.until))

    return () => clearTimeout(timer)
    // `cue` is rebuilt every render from exactly the values listed here; listing it
    // would re-arm the timer on every render instead of on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [begin, clock, durations, loop, wake])

  if (!items.length) return null

  return (
    <div className={cx('ss-sequence', className)} {...rest}>
      {items.map((item, at) => (
        <Current.Provider key={item.key} value={{ on: at === index, transition }}>
          {item}
        </Current.Provider>
      ))}
    </div>
  )
}

/**
 * @typedef {object} SequenceItemProps
 * @property {number} [duration] - Seconds it is the current item. Its entrance counts, its exit does not. `0` takes it out of the rotation. `NaN`, the default, takes the sequence's `duration`.
 * @property {string|null} [transition] - Motion variants — e.g. `"slide-up ease-back"`. `null`, the default, takes the sequence's `transition`.
 * @property {import("react").ReactNode} [children]
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * One slide of a `Sequence`: anything at all, in and out with a `transition` of its
 * own. Must be a direct child of the `Sequence`, which reads its `duration`; outside
 * one it is never on.
 *
 * @example
 * <SequenceItem duration={10} transition="wipe">
 *   <Variable name="sponsor.line" />
 * </SequenceItem>
 *
 * @param {SequenceItemProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function SequenceItem({ duration: _duration = NaN, transition = null, className, children, ...rest }) {
  // `duration` is the Sequence's to read, off these props, so the Sequence applies
  // the same NaN default itself. Taken out here so it does not reach the DOM.
  const current = useContext(Current)

  return (
    <Transition trigger={current.on} transition={transition ?? current.transition} className={cx('ss-sequence-item', className)} {...rest}>
      {children}
    </Transition>
  )
}
