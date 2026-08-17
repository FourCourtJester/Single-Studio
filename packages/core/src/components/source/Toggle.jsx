import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { Transition } from '../common/Transition'

/** Show or hide a block of graphics on the operator's say-so. */
export function Toggle({ name, children, className, namespace = 'toggles', ...rest }) {
  const active = Boolean(useVelcroValue(`${namespace}.${name}`, false))

  return (
    <Transition trigger={active} className={cx('ss-toggle', className)} {...rest}>
      {active ? children : null}
    </Transition>
  )
}
