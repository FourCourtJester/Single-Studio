// Import core components
import cN from 'classnames'

// Import our components
import { useStudio } from 'hooks'
import { Transition } from 'components/global'
import { Variable as StyledVariable } from 'components/global/styled/source'

// Import style
// ...

const namespace = 'variables'
const defaults = {
  transition: {
    update: undefined,
  },
}

export const Variable = (properties) => {
  // Properties
  const { className, fallback, name } = properties
  const { transition = {} } = properties
  // Redux
  const _val = useStudio(`${namespace}.${name}`)
  const val = typeof _val === 'number' ? _val : _val || fallback || ''

  return (
    <Transition {...properties} className={cN('variable', className)} update={transition?.update || defaults.transition.update} trigger={val}>
      <StyledVariable $animation={transition?.animation}>{val}</StyledVariable>
    </Transition>
  )
}
