import { useEffect, useMemo, useState } from 'react'

import { useAssetLibrary } from '../../hooks/useAssets'
import { useClockOffset } from '../../hooks/useSync'
import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { picturesFor, slideFor, slideTick, untilNextSlide } from '../../toolkits/slideshow'
import { parseDuration } from '../../toolkits/time'
import { Image } from './Image'

/** Where a curated list lives, when one is named. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

/** A stored value as a list. One pick is stored bare, several as an array. */
function toList(value) {
  if (Array.isArray(value)) return value

  return value === undefined || value === null || value === '' ? [] : [value]
}

/**
 * @typedef {object} SlideshowProps
 * @property {string} [group] - Plays everything in the image library filed under this group — `"slides"` reads `slides/…`.
 * @property {string} [name] - Names a list under `variables` — e.g. `standby.slides`. Takes over from `group` whenever it holds anything.
 * @property {string|number} [every] - How long each picture holds — seconds, or `"m:ss"`. Defaults to `8`.
 * @property {'sequence'|'shuffle'} [order] - In order, or a fresh deal each pass. Defaults to `"sequence"`.
 * @property {number} [limit] - Play at most this many.
 * @property {number} [preload] - How many either side of the current one hold a decoded image. Defaults to `1`.
 * @property {'cover'|'contain'} [fit] - How a picture fills the frame. Defaults to `"cover"`.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * A folder of pictures, playing. What a standby screen is made of.
 *
 * Point it at a group in the image library and dropping a folder on the board is
 * loading the show — there is no list in the studio to keep in step with what the
 * operator actually uploaded:
 *
 *   <Slideshow group="slides" every={9} order="shuffle" />
 *
 * Name a path instead — or as well — and an operator can curate: `ImageSelect
 * multiple` writes the list, and it takes over from the group whenever it holds
 * anything, so a studio can offer "the whole folder, unless somebody has picked."
 *
 * **What is on screen is decided by the clock, not by a timer.** A counter belongs
 * to whichever tab is running it, and a show has several — the programme source,
 * a preview beside it, a second machine in the room — which drift apart within
 * minutes. The picture is arithmetic on the time in the room instead, so every
 * output lands on the same one at the same instant, having agreed with nobody. A
 * browser source closed and reopened mid-show comes back in step rather than
 * starting the deck again.
 *
 * **It only plays what this machine can actually paint.** The library replicates
 * what *exists* to everyone, but a file dropped on a producer's laptop has bytes
 * that live only there. Those are left out rather than going out as blank slides.
 *
 * **An empty group renders nothing at all** -- no element, not an empty one -- and
 * arms no timer. There is deliberately nothing to style for that case: a holding
 * card is a sibling in the studio, which can say what this show is waiting for,
 * where a built-in one could only be blank.
 *
 * **It follows the library while it plays.** Dropping pictures into the group
 * during a programme adds them to the deck without a reload, and removing them
 * takes them out; loading the show and running it are the same act.
 *
 * Every picture gets a `.ss-slide`, and the one on screen carries `data-on`. What
 * a slide *does* is the studio's business — cross-fade, cut, drift, wipe — the
 * same way a transition is a class name rather than more code in here. The
 * built-in styling is a cross-fade over `--ss-fade` and nothing else.
 *
 * Only the pictures within `preload` of the current one hold a decoded image. A
 * full-frame decode is megabytes and a folder can be hundreds; keeping the near
 * ones live is what makes a change a cross-fade rather than a wait, without
 * holding the whole folder in memory. Every slide keeps its element either way,
 * so `:nth-child` in a stylesheet is stable.
 *
 * @example
 * <Slideshow group="slides" every={9} order="shuffle" />
 *
 * @example
 * // The folder, unless the operator has picked from it
 * <Slideshow group="slides" name="standby.slides" every="0:12" />
 *
 * @param {SlideshowProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Slideshow({ group, name, every = 8, order = 'sequence', limit, preload = 1, fit = 'cover', className, ...rest }) {
  const { assets } = useAssetLibrary()
  const { value, loaded } = useVelcroState(name ? `${NAMESPACE}.${name}` : undefined)
  const offset = useClockOffset()

  const dwell = parseDuration(every)
  const prefix = group ? (group.endsWith('/') ? group : `${group}/`) : null

  const pictures = useMemo(() => {
    // A named path that has not arrived yet is not an empty one. Falling through to
    // the group here would deal the folder for a frame and then re-deal the pick.
    if (name && !loaded) return []

    return picturesFor({ picked: name ? toList(value) : [], prefix, assets, limit })
  }, [assets, limit, loaded, name, prefix, value])

  const count = pictures.length
  const [tick, setTick] = useState(() => slideTick({ now: Date.now() + offset, every: dwell }))

  useEffect(() => {
    if (count < 2 || dwell <= 0) return undefined

    // Scheduled to the boundary rather than as an interval, and re-scheduled off
    // the clock every time: a tab that was throttled in the background, or a
    // machine whose offset has just been corrected, lands on the right picture at
    // the next change instead of staying however far behind it woke up. `tick`
    // always advances, so this effect always arms the next one.
    const wait = Math.max(50, untilNextSlide({ now: Date.now() + offset, every: dwell }))
    const timer = setTimeout(() => setTick(slideTick({ now: Date.now() + offset, every: dwell })), wait)

    return () => clearTimeout(timer)
  }, [count, dwell, offset, tick])

  const showing = slideFor({ tick, count, order })

  // Which pictures are worth holding decoded: the ones the next few ticks will
  // ask for, asked of the order itself.
  //
  // Measuring this as a distance in the list looks equivalent and is not. In
  // sequence the neighbours of the current picture are the ones coming next, so it
  // works by coincidence; under a shuffle the next picture is wherever the deal put
  // it, and the window covers the wrong slides. Measured at eight pictures, the
  // incoming one fell outside a list-distance window on 554 changes out of 800 --
  // and a slide that is on air before it has decoded fades in empty, which is the
  // one thing keeping them mounted was for.
  const upcoming = new Set()

  for (let step = -preload; step <= preload; step += 1) upcoming.add(slideFor({ tick: tick + step, count, order }))

  if (!count) return null

  return (
    <div className={cx('ss-slideshow', className)} {...rest}>
      {pictures.map((picture, index) => (
        <div key={`${picture}:${index}`} className="ss-slide" data-on={index === showing ? '' : undefined}>
          {upcoming.has(index) ? <Image value={picture} alt="" fit={fit} /> : null}
        </div>
      ))}
    </div>
  )
}
