// Import core components
import { FloatingLabel, Form } from 'react-bootstrap'

// Import our components
import { useStudio } from 'hooks'
import { useEffect, useState } from 'react'

// Import style
// ...

const namespace = 'variables'

/**
 * Component: Variable
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
export const Variable = (properties) => {
  // Properties
  const { as: type = 'text', label, name, placeholder } = properties
  const path = `${namespace}.${name}`
  // Redux
  const val = useStudio(path) || ''
  // States
  const [props, setProps] = useState({})

  useEffect(() => {
    setProps({
      defaultValue: val,
      name,
      placeholder: placeholder || label,
      [type === 'textarea' ? 'as' : 'type']: type,
    })
  }, [label, name, placeholder, type, val])

  return (
    <FloatingLabel label={label} controlId={name}>
      <Form.Control {...props} />
    </FloatingLabel>
  )
}
