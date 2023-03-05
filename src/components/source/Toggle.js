// Import core components
import { useEffect, useRef, useState } from 'react'
import { CSSTransition } from 'react-transition-group'
import cN from 'classnames'

// Import our components
import { useNamespace, useStudio } from 'hooks'

// Import style
// ...

const namespace = 'toggles'

export const Toggle = (properties) => {
  // Properties
  const { children, name } = properties
  // Hooks
  const path = useNamespace({ type: namespace, name })
  // Redux
  const val = useStudio(path) || false
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { className } = properties

    setProps({
      ...properties,
      className: cN('toggle', className),
    })
  }, [properties, val])

  return (
    <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next, true)} appear in={val} nodeRef={$ref}>
      <div ref={$ref} {...props}>
        {children}
      </div>
    </CSSTransition>
  )
}
