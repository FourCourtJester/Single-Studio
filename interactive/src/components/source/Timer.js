// Import core components
import { useEffect, useRef, useState } from 'react'
import { CSSTransition } from 'react-transition-group'
import cN from 'classnames'

// Import our components
import { useNamespace } from 'hooks'
import { useTimer } from '../studio/hooks'

// Import style
// ...

const namespace = 'timers'

export const Timer = (properties) => {
  // Properties
  const { name } = properties
  // Hooks
  const path = useNamespace({ type: namespace, name })
  const { active, text } = useTimer({ path })
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { className } = properties

    setProps({
      ...properties,
      className: cN('timer', className),
    })
  }, [properties])

  return (
    <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next)} appear in={active} nodeRef={$ref}>
      <span ref={$ref} {...props}>
        {text}
      </span>
    </CSSTransition>
  )
}
