// Import core components
import { useEffect, useRef, useState } from 'react'
import { FloatingLabel, Form } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { useStudio } from 'hooks'

// Import style
// ...

const namespace = 'variables'

export const Variable = (properties) => {
  // Properties
  const { align, as: type = 'text', label, name, placeholder, ...otherProps } = properties
  // Redux
  const val = useStudio(`${namespace}.${name}`) || null
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    $ref.current.value = val
  }, [val])

  useEffect(() => {
    setProps({
      defaultValue: val,
      name: `${namespace}.${name}`,
      placeholder: placeholder || label,
      [type === 'textarea' ? 'as' : 'type']: type,
    })
  }, [label, name, placeholder, type, val])

  return (
    <FloatingLabel label={label} controlId={name} {...otherProps}>
      <Form.Control ref={$ref} className={cN(align ? `text-${align}` : false)} {...props} />
    </FloatingLabel>
  )
}
