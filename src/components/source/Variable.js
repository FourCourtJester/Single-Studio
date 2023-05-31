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
  const { fallback, name } = properties
  // Hooks
  const path = useNamespace(...(name ? [namespace, name] : [false]))
  // Redux
  const val = useStudio(path) || fallback || ''
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { className } = properties

    setProps({
      ...properties,
      className: cN('variable', className),
      fallback: undefined,
    })
  }, [properties])

  return (
    <SwitchTransition>
      <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next, true)} appear key={val} nodeRef={$ref}>
        <span ref={$ref} {...props}>
          {val}
        </span>
      </CSSTransition>
    </SwitchTransition>
  )
}
