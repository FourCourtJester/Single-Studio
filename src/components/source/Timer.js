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
  const { fallback, name, value } = properties
  // Hooks
  const path = useNamespace(namespace, name)
  const { active, text } = useTimer({ path, value })
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { className, onComplete, onEnter, onExit, ..._properties } = properties

    setProps({
      ..._properties,
      className: cN('timer', className),
      fallback: undefined,
      value: undefined,
    })
  }, [properties])

  useEffect(() => {
    const { onEnter, onComplete, onExit } = properties

    if (active && onEnter) onEnter()
    else if (!active && onExit) onExit()
    else if (!active && onComplete) onComplete()
  }, [active, properties])

  return (
    <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next)} appear in={active} nodeRef={$ref}>
      <time ref={$ref} {...props}>
        {fallback || text}
      </time>
    </CSSTransition>
  )
}
