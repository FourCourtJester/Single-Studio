// Import core components
import cN from 'classnames'

// Import our components
import { Transition } from 'components/global'
import { Variable as StyledVariable } from 'components/global/styled/source'
import { Fit } from 'components/source/components'
import { useVelcroValue } from 'hooks'

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
  const { className, fallback, fit, name } = properties
  const { transition = {} } = properties
  // Hooks
  const _val = useVelcroValue(`${namespace}.${name}`)
  // Variables
  const val = typeof _val === 'number' ? _val : _val || fallback || ''

  return (
    <Transition {...properties} className={cN('variable', className)} update={transition?.update || defaults.transition.update} trigger={val}>
      {fit ? (
        <Fit>
          <StyledVariable $animation={transition?.animation}>{val}</StyledVariable>
        </Fit>
      ) : (
        <StyledVariable $animation={transition?.animation}>{val}</StyledVariable>
      )}
    </Transition>
  )
}
