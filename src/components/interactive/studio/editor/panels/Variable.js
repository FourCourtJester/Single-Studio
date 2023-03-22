// Import core components
import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Form, Stack, Toast } from 'react-bootstrap'

// Import our components
import { updateInteractive } from 'db/slices/interactive'

// Import style
// ...

export const VariablePanel = (properties) => {
  // Properties
  const { id, type } = properties
  // Hooks
  const dispatch = useDispatch()
  // States
  const [show, setShow] = useState(true)

  const handleClose = (e) => {
    dispatch(updateInteractive({ id: undefined }))
    setShow(false)
  }

  return (
    <Toast show={show} onClose={handleClose}>
      <Toast.Header>
        <span className="me-auto">{type}</span>
      </Toast.Header>
      <Toast.Body>
        <Stack gap={2}>
          <Stack direction="horizontal" gap={2}>
            <Form.Group>
              <Form.Control className="bg-transparent border-0 border-bottom border-dark text-dark rounded-0" size="sm" placeholder="Name" />
            </Form.Group>
            <Form.Group>
              <Form.Control className="bg-transparent border-0 border-bottom border-dark text-dark rounded-0" size="sm" placeholder="Path" />
            </Form.Group>
          </Stack>
        </Stack>
      </Toast.Body>
    </Toast>
  )
}
