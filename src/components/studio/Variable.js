// Import core components
import { FloatingLabel, Form } from 'react-bootstrap'

// Import our components
import { useStudio } from 'hooks'

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
  // Variables
  const props = {
    defaultValue: val,
    name,
    placeholder: placeholder || label,
    [type === 'textarea' ? 'as' : 'type']: type,
  }

  return (
    <FloatingLabel label={label} controlId={name}>
      <Form.Control {...props} />
    </FloatingLabel>
  )
}
