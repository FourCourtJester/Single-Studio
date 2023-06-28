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
  const { fallback, name, onComplete, onEnter, onExit, value } = properties
  // Hooks
  const path = useNamespace(namespace, name)
  const { active, text } = useTimer({ path, value })
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { className, onComplete: _, onEnter: __, onExit: ___, ..._properties } = properties

    setProps({
      ..._properties,
      className: cN('timer', className),
      fallback: undefined,
      value: undefined,
    })
  }, [properties])

  useEffect(() => {
    if (active && onEnter) onEnter()
    else if (!active && onExit) onExit()
    else if (!active && onComplete) onComplete()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next)} appear in={active} nodeRef={$ref}>
      <time ref={$ref} {...props}>
        {fallback || text}
      </time>
    </CSSTransition>
  )
}
