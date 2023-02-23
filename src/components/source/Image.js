// Import core components
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Image } from 'react-bootstrap'
import { CSSTransition, SwitchTransition } from 'react-transition-group'

// Import our components
import { useStudio } from 'hooks'

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
  const params = useParams()
  // Redux
  const val = useStudio(path) || ''
  // States
  const [props, setProps] = useState({})
  // Variables
  const publik = `/${params.code}`
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { src = false } = properties

    setProps({
      ...properties,
      src: src ? `${publik}/${src.replace(/:var:/, val)}` : `1x1.png`,
    })
  }, [properties, publik, val])

  return (
    <SwitchTransition>
      <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next, true)} appear key={val} nodeRef={$ref}>
        <Image ref={$ref} {...props} />
      </CSSTransition>
    </SwitchTransition>
  )
}
