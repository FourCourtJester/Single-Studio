// Import core components
import cN from 'classnames'

// Import our components
import { useStudio } from 'hooks'
import { Transition } from 'components/global'
import { Toggle as StyledToggle } from 'components/global/styled/source'

// Import style
// ...

const namespace = 'toggles'

export const Toggle = (properties) => {
  // Properties
  const { children, className, name } = properties
  const { $animation } = properties
  // Redux
  const val = useStudio(`${namespace}.${name}`) || false

  return (
    <Transition {...properties} className={cN('toggle', className)} trigger={val}>
      <StyledToggle $animation={$animation}>{children}</StyledToggle>
    </Transition>
  )
}
