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
  const { name, onEnter, onExit } = properties
  // Hooks
  const path = useNamespace({ type: namespace, name })
  const { active, text } = useTimer({ path })
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { className, ..._properties } = properties

    delete _properties.onEnter
    delete _properties.onExit

    setProps({
      ..._properties,
      className: cN('timer', className),
    })
  }, [properties])

  useEffect(() => {
    if (active && onEnter) onEnter()
    else if (onExit) onExit()
  }, [active, onEnter, onExit])

  return (
    <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next)} appear in={active} nodeRef={$ref}>
      <time ref={$ref} {...props}>
        {text}
      </time>
    </CSSTransition>
  )
}
