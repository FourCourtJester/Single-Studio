// Import core components
import { useEffect, useRef, useState } from 'react'
import { CSSTransition, SwitchTransition } from 'react-transition-group'
import cN from 'classnames'

// Import our components
import { usePublic, useStudio } from 'hooks'

// Import style
// ...

const namespace = 'variables'

/**
 * Component: Image
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
export const _Image = (properties) => {
  // Properties
  const { name } = properties
  const path = `${namespace}.${name}`
  // Hooks
  const publik = usePublic()
  // Redux
  const val = useStudio(path) || ''
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { className, src = false } = properties

    setProps({
      ...properties,
      className: cN('variable', className),
      src: src ? `${publik}/${src.replace(/:var:/, val)}` : `1x1.png`,
    })
  }, [properties, publik, val])

  return (
    <SwitchTransition>
      <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next, true)} appear key={val} nodeRef={$ref}>
        <img ref={$ref} {...props} />
      </CSSTransition>
    </SwitchTransition>
  )
}
