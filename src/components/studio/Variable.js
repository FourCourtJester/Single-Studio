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
  const { label, name, placeholder } = properties
  const path = `${namespace}.${name}`
  // Redux
  const val = useStudio(path) || ''

  return (
    <FloatingLabel label={label} controlId={name}>
      <Form.Control name={name} type="text" placeholder={placeholder || label} defaultValue={val} />
    </FloatingLabel>
  )
}
