// Import core components
import { useEffect, useRef, useState } from 'react'
import { CSSTransition, SwitchTransition } from 'react-transition-group'
import cN from 'classnames'

// Import our components
import { useNamespace, usePublic, useStudio } from 'hooks'
import * as Utils from 'toolkits/utils'

// Import style
// ...

const namespace = 'variables'
const defaultSrc = '1x1.png'

export const Image = (properties) => {
  // Properties
  const { name, timeout } = properties
  // Hooks
  const path = useNamespace(...(name ? [namespace, name] : [false]))
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
    // TODO: External image sources
    const { slug = false, src: _src } = properties
    setSrc(`${publik}/${_src.replace(/:var:/, slug ? Utils.slugify(val) : val)}`)
  }, [properties, publik, val])

  useEffect(() => {
    const { className } = properties

    setProps({
      ...properties,
      className: cN('variable', className),
      'data-error': src === defaultSrc ? true : undefined,
      onError: handleError,
      slug: undefined,
      src,
      timeout: undefined,
    })
  }, [properties, src])

  return (
    <SwitchTransition>
      <CSSTransition addEndListener={(next) => $ref.current.addEventListener('transitionend', next, true)} appear key={src} nodeRef={$ref} timeout={timeout}>
        <img ref={$ref} {...props} />
      </CSSTransition>
    </SwitchTransition>
  )
}
