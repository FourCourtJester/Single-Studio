// Import core components
import { useEffect, useRef, useState } from 'react'
import { FloatingLabel, Form } from 'react-bootstrap'

// Import our components
import { useNamespace, useStudio } from 'hooks'

// Import style
// ...

const namespace = 'variables'

export const Select = (properties) => {
  // Properties
  const { children, label, name } = properties
  const path = useNamespace({ type: namespace, name })
  // Redux
  const val = useStudio(path) || ''
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    setProps({
      name: `${namespace}.${name}`,
    })
  }, [label, name])

  useEffect(() => {
    $ref.current.value = val
  }, [val])

  return (
    <FloatingLabel label={label} controlId={name}>
      <Form.Select ref={$ref} {...props}>
        <option key="_" value="">
          -- N/A --
        </option>
        {children}
      </Form.Select>
    </FloatingLabel>
  )
}
