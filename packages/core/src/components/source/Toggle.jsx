import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { Transition } from '../common/Transition'

/**
 * Show or hide a block of graphics on the operator's say-so.
 *
 * Hidden until the path has loaded, so a source rebuilt mid-show never flashes its
 * contents before finding out it was supposed to be off.
 */
export function Toggle({ name, children, className, namespace = 'toggles', ...rest }) {
  const { value, loaded } = useVelcroState(`${namespace}.${name}`)
  const active = loaded && Boolean(value)

  return (
    <Transition trigger={active} className={cx('ss-toggle', className)} {...rest}>
      {active ? children : null}
    </Transition>
  )
}
