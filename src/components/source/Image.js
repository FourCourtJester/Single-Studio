// Import core components
import { useEffect, useRef, useState } from 'react'
import { CSSTransition, SwitchTransition } from 'react-transition-group'
import cN from 'classnames'

// Import our components
import { usePublic, useStudio } from 'hooks'
import { Transition } from 'components/global'
import { Image as StyledImage } from 'components/global/styled/source'
import { slugify } from 'toolkits/utils'

// Import style
// ...

const namespace = 'variables'
const defaultSrc = `${process.env.PUBLIC_URL}/1x1.png`

export const Image = (properties) => {
  // Properties
  const { className, name, slug = false, src } = properties
  const { $animation } = properties
  // Hooks
  const publik = usePublic()
  // Redux
  const val = useStudio(`${namespace}.${name}`) || false
  // States
  const [modifiedSrc, setSrc] = useState(defaultSrc)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const local = src.startsWith('/')
    const url = src.replace(/:var:/, slug ? slugify(val) : val)
    const img = local ? `${publik}${url}` : `${url}`

    setSrc((_modifiedSrc) => {
      if (_modifiedSrc !== img) setActive(false)
      return img
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, src, val])

  const handleError = () => {
    console.warn(`Image ${modifiedSrc} did not load`)
    setSrc(defaultSrc)
    setActive(false)
  }

  const handleLoad = () => setActive(true)

  return (
    <Transition {...properties} className={cN('variable', className)} trigger={active}>
      <StyledImage src={modifiedSrc} onLoad={handleLoad} onError={handleError} $animation={$animation} />
    </Transition>
  )
}
