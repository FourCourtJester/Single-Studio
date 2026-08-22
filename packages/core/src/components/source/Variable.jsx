import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { Fit } from '../common/Fit'
import { Transition } from '../common/Transition'

/**
 * @typedef {object} VariableProps
 * @property {string} name - Path under `namespace`, e.g. `home.score`.
 * @property {string} [fallback] - Shown when the value is empty. Defaults to `""`.
 * @property {boolean|number} [fit] - Shrink the text to fit its box. A number caps how far.
 * @property {string} [namespace] - Where the value lives. Defaults to `variables`.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * A text value from the operator's board. The workhorse graphic.
 *
 * Renders nothing until the path has loaded, then fades in. That matters for
 * sources set to unload when hidden: they are rebuilt from scratch every time the
 * scene returns, and painting the fallback on mount would flash "Home" on air
 * before the real name arrived. The fallback is for a path that has loaded and is
 * genuinely empty.
 *
 * @param {VariableProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Variable({ name, fallback = '', fit = false, className, namespace = 'variables', ...rest }) {
  const { value, loaded } = useVelcroState(name ? `${namespace}.${name}` : undefined)
  const text = value === undefined || value === '' ? fallback : String(value)

  return (
    <Transition trigger={loaded ? text : false} className={cx('ss-variable', className)} {...rest}>
      {loaded ? fit ? <Fit>{text}</Fit> : text : null}
    </Transition>
  )
}
