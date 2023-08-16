// Import core components
import { useEffect, useRef, useState } from 'react'
import { CSSTransition, SwitchTransition } from 'react-transition-group'
import cN from 'classnames'

// Import our components
import { useNamespace, useStudio } from 'hooks'
import { setObjValue } from 'toolkits/utils'

// Import style
// ...

const namespace = 'variables'

export const Text = (properties) => {
  // Properties
  const { name } = properties
  // Hooks
  const path = useNamespace(...(name ? [namespace, name] : [false]))
  // Redux
  const cache = useStudio(path)
  // States
  const [props, setProps] = useState({})
  const [val, setVal] = useState('')
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { className, fallback } = properties

    setProps({
      ...properties,
      className: cN('text', className),
      fallback: undefined,
    })

    if (cache === undefined) setVal(fallback || '')
    else setVal(cache.toString() || fallback || '')
  }, [properties, cache])

  return (
    <span ref={$ref} {...props}>
      {val}
    </span>
  )
}
