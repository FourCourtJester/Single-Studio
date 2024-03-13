// Import core components
import cN from 'classnames'

// Import our components
import { useVelcroValue } from 'hooks'
import { Transition } from 'components/global'
import { Toggle as StyledToggle } from 'components/global/styled/source'

// Import style
// ...

const namespace = 'toggles'
const defaults = {
  transition: {
    update: ['active', 'inactive'],
  },
}

export const Toggle = (properties) => {
  // Properties
  const { children, className, name } = properties
  const { transition = {} } = properties
  // Hooks
  const val = useVelcroValue(`${namespace}.${name}`) || false

  return (
    <Transition {...properties} className={cN('toggle', className)} update={transition?.update || defaults.transition.update} trigger={val}>
      <StyledToggle $animation={transition?.animation}>{children}</StyledToggle>
    </Transition>
  )
}
