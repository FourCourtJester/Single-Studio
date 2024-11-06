// Import core components
import { useEffect, useRef, useState } from 'react'
import { FloatingLabel, Form } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { useVelcroValue } from 'hooks'

// Import style
// ...

const namespace = 'variables'

export const Variable = (properties) => {
  // Properties
  const { align, as: type = 'text', disabled, label = 'Variable', name, placeholder, readOnly, rows, ...otherProps } = properties
  // Hooks
  const val = useVelcroValue(`${namespace}.${name}`) || null
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef()

  useEffect(() => {
    $ref.current.value = val
  }, [val])

  useEffect(() => {
    setProps({
      disabled,
      defaultValue: val,
      name: `${namespace}.${name}`,
      placeholder: placeholder || label,
      [type === 'textarea' ? 'as' : 'type']: type,
      readOnly,
      rows,
    })
  }, [disabled, label, name, placeholder, type, readOnly, rows, val])

  return (
    <FloatingLabel label={label} controlId={name} {...otherProps}>
      <Form.Control ref={$ref} className={cN(align ? `text-${align}` : false)} {...props} />
    </FloatingLabel>
  )
}
