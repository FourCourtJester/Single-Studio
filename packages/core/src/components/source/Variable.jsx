import { useVelcroState } from '../../hooks/useVelcroValue'
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
 * @param {VariableProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Variable({ name, fallback = '', fit = false, className, ...rest }) {
  const { value, loaded } = useVelcroState(name ? `${NAMESPACE}.${name}` : undefined)
  const text = value === undefined || value === '' ? fallback : String(value)

  return (
    <Transition trigger={loaded ? text : false} className={cx('ss-variable', className)} {...rest}>
      {loaded ? fit ? <Fit>{text}</Fit> : text : null}
    </Transition>
  )
}
