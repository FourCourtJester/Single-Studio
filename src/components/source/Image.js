// Import core components
import { useEffect, useRef, useState } from 'react'
import { CSSTransition, SwitchTransition } from 'react-transition-group'
import cN from 'classnames'

// Import our components
import { useNamespace, usePublic, useStudio } from 'hooks'

// Import style
// ...

const namespace = 'variables'
const defaultSrc = '1x1.png'

export const _Image = (properties) => {
  // Properties
  const { name } = properties
  // Hooks
  const path = useNamespace({ type: namespace, name })
  // Hooks
  const publik = usePublic()
  // Redux
  const val = useStudio(path) || ''
  // States
  const [props, setProps] = useState({})
  const [src, setSrc] = useState(defaultSrc)
  // Refs
  const $ref = useRef(null)

  const handleError = (e) => {
    console.warn(e)
    setSrc(defaultSrc)
  }

  useEffect(() => {
    const { src: _src } = properties

    setSrc(`${publik}/${_src.replace(/:var:/, val)}`)
  }, [properties, publik, val])

  useEffect(() => {
    const { className } = properties

    setProps({
      ...properties,
      className: cN('variable', className),
      onError: handleError,
      src,
      // src: src ? `${publik}/${src.replace(/:var:/, val)}` : `1x1.png`,
    })
  }, [properties, publik, src, val])

  return (
    <SwitchTransition>
      <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next, true)} appear key={val} nodeRef={$ref}>
        <img ref={$ref} {...props} />
      </CSSTransition>
    </SwitchTransition>
  )
}
