import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { MARKS, tallyOf } from '../../toolkits/tally'
import { Transition } from '../common/Transition'
import { Image } from './Image'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

/**
 * @typedef {object} TallyProps
 * @property {string} name - Names a count under `variables` — e.g. `home.demolitions`.
 * @property {string} src - The mark. A path, a URL, or a library entry, the same as `Image` takes.
 * @property {number|string} [of] - Draw this many marks and fill the count — a number, or a path an operator sets.
 * @property {string} [empty] - The mark for one not yet filled. Without it an unfilled mark holds its space and shows nothing.
 * @property {number} [max] - The most marks to draw without an `of`. Defaults to `12`; `0` for no bound.
 * @property {string} [alt] - Alt text for every mark.
 * @property {string} [transition] - Motion variants for a mark arriving or filling, space-separated — e.g. `"zoom ease-back"`. See [the transitions guide](getting-started.md#transitions).
 * @property {string} [className] - Added to the component's own classes.
 * @property {string} [itemClassName] - Added to each mark rather than to the row.
 */
/**
 * A number said in icons. Three demolitions is three icons, not the word three.
 *
 *   <Tally name="home.demolitions" src="./icons/demo.svg" />
 *
 * Give it an `of` and it becomes a race: that many marks, the count filled in, the
 * rest waiting. A series is the obvious one, and the row holds its width from the
 * first frame, so nothing beside it moves as the games are won.
 *
 *   <Tally name="home.games" of={3} src="./pips/won.svg" empty="./pips/lost.svg" />
 *
 * `of` is the number of marks, not the length of the race: a best-of-five is three
 * of these, because three is what wins it. Store the number of marks, or let an
 * operator pick it — `of` takes a path as readily as a number.
 *
 * **Only what changed animates.** Each mark is its own element with its own place
 * in the row, so a fourth demolition brings in a fourth icon and leaves the three
 * already on screen alone. A row that re-animates in full every time the count
 * moves reads as the graphic glitching rather than as something having happened,
 * and it is what wrapping the whole row in one transition gets you.
 *
 * **A count is bounded, a race is not.** Forty of anything is not a number anyone
 * reads off a row of icons, and an operator with a stuck key should cost a clamp
 * rather than the layout — so a plain count stops at `max`. Clamping quietly would
 * be a lie on air, though, so the row carries `data-count` with the real figure and
 * `data-over`/`ss-over` when there was more than it could show, and what to do
 * about that is the studio's. An `of` is a length that was asked for outright and
 * is never clamped.
 *
 * Every mark carries `data-filled` when it is one, so filled and empty can be told
 * apart in a stylesheet even when both are the same picture.
 *
 * @example
 * <Tally name="home.demolitions" src="./icons/demo.svg" />
 *
 * @example
 * // A best-of-five: three to win, won ones filled
 * <Tally name="home.games" of={3} src="./pips/won.svg" empty="./pips/empty.svg" />
 *
 * @example
 * // The race length is the operator's
 * <Tally name="home.games" of="series.wins" src="./pips/won.svg" />
 *
 * @param {TallyProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Tally({ name, src, of, empty, max = MARKS, alt = '', transition, className, itemClassName, ...rest }) {
  const { value, loaded } = useVelcroState(name ? `${NAMESPACE}.${name}` : undefined)
  // A number is the length outright; anything else names a path holding one. Read
  // that way round rather than by type alone so `of="5"` means five, which is what
  // anyone writing it meant.
  const literal = Number(of)
  const named = of !== undefined && of !== null && of !== '' && !Number.isFinite(literal) ? String(of) : null
  const race = useVelcroState(named ? `${NAMESPACE}.${named}` : undefined)

  // Both paths, not just the count. Each subscription hydrates on its own round
  // trip, so a race whose length has not arrived yet would draw `count` marks and
  // reflow to its real length a moment later -- which is the shift that drawing the
  // empties exists to prevent.
  if (!loaded || (named && !race.loaded)) return null

  const { marks, filled, count, over } = tallyOf({ value, of: named ? race.value : of, max })

  if (!marks) return null

  return (
    <div className={cx('ss-tally inline-flex items-center gap-1', over && 'ss-over', className)} data-count={count} data-over={over ? '' : undefined} {...rest}>
      {Array.from({ length: marks }, (_, index) => {
        const on = index < filled
        // Without an `empty` picture an unfilled mark is the filled one, hidden --
        // which holds exactly the right space without a studio having to size
        // anything, and keeps the row from moving as it fills.
        const picture = on ? src : (empty ?? src)

        return (
          <Transition
            // The trigger is which state the mark is in rather than whether it is
            // on, because both states are meant to be seen: a falsy trigger is how
            // Transition says "hidden", and an empty pip is not hidden.
            key={index}
            trigger={on ? 'filled' : 'empty'}
            transition={transition}
            data-filled={on ? '' : undefined}
            className={cx('ss-tally-mark', itemClassName)}
          >
            <Image value={picture} alt={alt} className={cx('ss-tally-image', !on && !empty && 'invisible')} />
          </Transition>
        )
      })}
    </div>
  )
}
