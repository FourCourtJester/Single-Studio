// Import core components
import { useEffect, useRef, useState } from 'react'
import { FloatingLabel, Form } from 'react-bootstrap'

// Import our components
import { useNamespace, useStudio } from 'hooks'

// Import style
// ...

const namespace = 'variables'

export const Variable = (properties) => {
  // Properties
  const { as: type = 'text', label, name, placeholder } = properties
  // Hooks
  const path = useNamespace({ type: namespace, name })
  // Redux
  const val = useStudio(path) || ''
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
    <FloatingLabel label={label} controlId={name}>
      <Form.Control ref={$ref} {...props} />
    </FloatingLabel>
  )
}
