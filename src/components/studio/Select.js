// Import core components
import { FloatingLabel, Form } from 'react-bootstrap'

// Import our components
import { useStudio } from 'hooks'
import { useEffect, useRef, useState } from 'react'

// Import style
// ...

const namespace = 'variables'

/**
 * Component: Select
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
export const Select = (properties) => {
  // Properties
  const { children, label, name } = properties
  const path = `${namespace}.${name}`
  // Redux
  const val = useStudio(path) || ''
  // States
  const [props, setProps] = useState({})
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    setProps({
      name,
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
