// Import core components
import { useEffect, useRef, useState } from 'react'
import { CSSTransition, SwitchTransition } from 'react-transition-group'
import cN from 'classnames'

// Import our components
import { useNamespace, useStudio } from 'hooks'

// Import style
// ...

const namespace = 'variables'

export const Variable = (properties) => {
  // Properties
  const { name } = properties
  // Hooks
  const path = useNamespace({ type: namespace, name })
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
