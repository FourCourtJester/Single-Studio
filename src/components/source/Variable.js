// Import core components
import { useEffect, useRef, useState } from 'react'
import { CSSTransition, SwitchTransition } from 'react-transition-group'
import cN from 'classnames'

// Import our components
import { useStudio } from 'hooks'

// Import style
// ...

const namespace = 'variables'

/**
 * Component: Variable
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
export const Variable = (properties) => {
  // Properties
  const { name } = properties
  const path = `${namespace}.${name}`
  // Redux
  const val = useStudio(path) || ''
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { className } = properties

    setProps({
      ...properties,
      className: cN('variable', className),
    })
  }, [properties, val])

  return (
    <SwitchTransition>
      <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next, true)} appear key={val} nodeRef={$ref}>
        <var ref={$ref} {...props}>
          {val}
        </var>
      </CSSTransition>
    </SwitchTransition>
  )
}
