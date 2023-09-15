// Import core components
import { useEffect, useRef, useState } from 'react'
import { CSSTransition, SwitchTransition } from 'react-transition-group'
import cN from 'classnames'

// Import our components
import { useStudio } from 'hooks'

// Import style
// ...

const namespace = 'variables'

export const Variable = (properties) => {
  // Properties
  const { fallback, name, cut = false } = properties
  // Redux
  const val = useStudio(`${namespace}.${name}`)
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { className, cut: _cut } = properties

    setProps({
      ...properties,
      className: cN(_cut ? 'text' : 'variable', className),
      cut: undefined,
      fallback: undefined,
    })
  }, [properties])

  if (cut) {
    return (
      <span ref={$ref} {...props}>
        {val || fallback || ''}
      </span>
    )
  }

  return (
    <SwitchTransition>
      <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next, true)} appear key={val} nodeRef={$ref}>
        <span ref={$ref} {...props}>
          {typeof val === 'number' ? val : val || fallback || ''}
        </span>
      </CSSTransition>
    </SwitchTransition>
  )
}
