import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { Transition } from '../common/Transition'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'toggles'

/**
 * @typedef {object} ToggleProps
 * @property {string} name - Names a value under `toggles` — e.g. `lowerthird`.
 * @property {import("react").ReactNode} [children] - Rendered always; visible while the toggle is on.
 * @property {string} [transition] - Motion variants, space-separated — e.g. `"slide-up ease-back"`. See [the transitions guide](getting-started.md#transitions).
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Shows its children while a toggle is on, and animates them in and out. This is
 * how a whole graphic is put on and taken off air.
 *
 * Hidden until the path has loaded, so a source rebuilt mid-show never flashes its
 * contents before finding out it was supposed to be off.
 *
 * **The children stay mounted while it is off**, hidden rather than removed. An
 * empty box has no size, so anything laid out around a toggle moves when it turns
 * on and moves back when it turns off -- and a percentage transform measured
 * against a collapsed box is zero, which parks a slide exactly where it should have
 * landed. Both are the kind of fault that looks fine until the one take where it
 * matters.
 *
 * The cost is that what is inside keeps running while it is off. That is usually
 * what you want -- a clock behind a hidden lower third should be showing the right
 * time when it appears, not starting from zero -- but anything genuinely expensive
 * belongs behind its own toggle rather than inside this one.
 *
 * @example
 * <Toggle name="lowerthird">
 *   <LowerThird />
 * </Toggle>
 *
 * @example
 * <Toggle name="stats" transition="slide-up ease-back">
 *   <StatsCard />
 * </Toggle>
 *
 * @param {ToggleProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Toggle({ name, children, className, ...rest }) {
  const { value, loaded } = useVelcroState(`${NAMESPACE}.${name}`)
  const active = loaded && Boolean(value)

  return (
    <Transition trigger={active} className={cx('ss-toggle', className)} {...rest}>
      {children}
    </Transition>
  )
}
