// Import core components
import { useContext } from 'react'
import { Form, InputGroup, Stack, Toast } from 'react-bootstrap'

// Import our components
import { Context } from '../Context'

// Import style
// ...

export const VariableFontSizePanel = (properties) => {
  // Contexts
  const { fn, fontSize: show = false } = useContext(Context)
  // Properties
  const { size = 16 } = properties

  const handleClose = (e) => {
    e.preventDefault()

    fn.toggle(e, 'fontSize')
  }

  const handleChange = (e) => {
    e.preventDefault()

    fn.change(null, { style: { fontSize: e.target.value } })
  }

  return (
    <Toast show={show} onClose={handleClose} animation={false}>
      <Toast.Header className="text-dark py-2 px-3">
        <span className="me-auto">Font Size</span>
      </Toast.Header>
      <Toast.Body className="d-flex flex-column justify-content-center align-items-center p-3">
        <Stack gap={2}>
          <InputGroup>
            <Form.Control className="bg-light border-1 text-dark text-end" type="number" size="sm" value={String(size)} onChange={handleChange} />
            <InputGroup.Text className="text-dark">px</InputGroup.Text>
          </InputGroup>
        </Stack>
      </Toast.Body>
    </Toast>
  )
}
