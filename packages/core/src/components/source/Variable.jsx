import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { Fit } from '../common/Fit'
import { Transition } from '../common/Transition'

/** A text value from the operator's board. The workhorse graphic. */
export function Variable({ name, fallback = '', fit = false, className, namespace = 'variables', ...rest }) {
  const value = useVelcroValue(`${namespace}.${name}`, fallback)
  const text = typeof value === 'number' ? String(value) : value || fallback

  return (
    <Transition trigger={text} className={cx('ss-variable', className)} {...rest}>
      {fit ? <Fit>{text}</Fit> : text}
    </Transition>
  )
}
