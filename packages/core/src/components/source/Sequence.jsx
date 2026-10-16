import { Children, createContext, isValidElement, useContext, useEffect, useLayoutEffect, useState } from 'react'

import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { cueAt } from '../../toolkits/sequence'
import { Transition } from '../common/Transition'

/** Where a starting toggle lives. Not a prop: a studio never needs another. */
const NAMESPACE = 'toggles'

/** Whether this item is the one on screen, and the motion it falls back to. */
const Current = createContext({ on: false, transition: 'fade' })

/**
 * @typedef {object} SequenceProps
 * @property {string} [toggle] - Names a toggle under `toggles` — e.g. `intro`. Plays from the first item when it goes on, and takes the sequence off when it goes off. Without one, the sequence plays from the first item when it mounts.
 * @property {number} [duration] - Seconds an item without a `duration` of its own is the current one. Defaults to `8`.
 * @property {boolean} [loop] - Go round again after the last item. `false` holds the last one, until the toggle goes off if there is one. Defaults to `true`.
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
 * **Without a `toggle` it starts when it mounts**, from the first item: when the
 * `Scene` it is in comes up, which for a browser source set to refresh when its
 * scene becomes active is when the scene is taken.
 *
 * **With a `toggle` it follows one**, playing from the first item when it goes
 * on, and leaving when it goes off.
 *
 * Either way, each output times it from its own start -- its own mount, or the
 * moment it saw the toggle change -- so a browser source reloaded mid-sequence
 * starts again from the first item, and two outputs mounted at different times are
 * on different items. That is by design; see docs/internal/sequence.md.
 *
 * Items are stacked in one place, so the sequence is the size of its largest item
 * and does not move as it plays. Everything stays mounted while it is off, as a
 * `Toggle`'s children do: a clock in an item that comes round once a minute shows
 * the right time when it arrives.
 *
 * Items have to be its direct children, because it reads `duration` off them. One
 * inside a component of your own, or a fragment, counts as a single item with the
 * defaults. Leaving one out, or changing a duration, while it plays moves it to
 * wherever the new durations say it would be by now, rather than finishing the item
 * on screen.
 *
 * @example
 * // The corner of a broadcast, round and round from when its scene comes up
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

  // Hidden until the toggle has loaded, so a source rebuilt mid-show never plays
  // its first item before finding out it was supposed to be off. Without a toggle
  // it is on from the moment it mounts.
  const on = toggle ? loaded && Boolean(value) : true

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

  // When this page started it, on this machine's clock: at mount without a toggle,
  // or when the toggle goes on. Kept across renders while it stays on, and forgotten
  // when the toggle goes off, so turning it on again plays from the top.
  //
  // Stamped as the sequence goes into the page, not while it renders, and before
  // the first paint. Rendering a source runs well ahead of committing it while the
  // page loads: stamped in render, the fixture's 1.2s first item was on screen for
  // 910ms; stamped here, 1201ms.
  const [begin, setBegin] = useState(null)

  useLayoutEffect(() => {
    setBegin((was) => (on ? (was ?? Date.now()) : null))
  }, [on])

  const cue = () => cueAt({ elapsed: Date.now() - begin, durations: durations ? durations.split(',').map(Number) : [], loop })

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
    // that was throttled in the background lands on the right item rather than the
    // next one in line.
    const now = cue()

    setIndex(now.index)

    if (!Number.isFinite(now.until)) return undefined

    const timer = setTimeout(() => setWake((n) => n + 1), Math.max(50, now.until))

    return () => clearTimeout(timer)
    // `cue` is rebuilt every render from exactly the values listed here; listing it
    // would re-arm the timer on every render instead of on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [begin, durations, loop, wake])

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
