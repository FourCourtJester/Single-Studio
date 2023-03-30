// Import core components
import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import { Button, Col, Form, Stack, Toast } from 'react-bootstrap'

// Import our components
import { selectComponent, updateInteractiveComponent, updateInteractiveSelected } from 'db/slices/interactive'
import * as Utils from 'toolkits/utils'

// Import style
// ...

export const VariablePanel = (properties) => {
  // Properties
  const { id, type } = properties
  // Hooks
  const params = useParams()
  const dispatch = useDispatch()
  // Redux
  const component = useSelector((state) => selectComponent(state, id))
  // States
  const [show, setShow] = useState(true)

  const handleClose = (e) => {
    e.preventDefault()

    dispatch(updateInteractiveSelected({ id: undefined }))
    setShow(false)
  }

  const handleChange = (e, attr) => {
    e.preventDefault()

    dispatch(
      updateInteractiveComponent({
        id,
        [attr]: e.target.value,
      })
    )
  }

  const handleLink = (e) => {
    e.preventDefault()
  }

  return (
    <Toast show={show} onClose={handleClose}>
      <Toast.Header className="py-2 px-3">
        <span className="me-auto">{Utils.capitalize(type)}</span>
      </Toast.Header>
      <Toast.Body className="p-3">
        <Stack gap={2}>
          <Stack direction="horizontal" gap={2}>
            <Col>
              <Form.Label className="d-flex align-items-center text-dark ps-2 mb-0">
                <small className="me-auto">Name</small>
                <Button className="text-dark" size="sm" variant="link" type="button" href={`#/studio/i/${params.code}/source/${id}`} target={id}>
                  <i className="fas fa-up-right-from-square" />
                </Button>
              </Form.Label>
              <Form.Control
                className="bg-transparent border-0 border-bottom border-dark text-dark rounded-0 py-0"
                defaultValue={component.label}
                size="sm"
                placeholder="Name"
                onChange={(e) => handleChange(e, 'label')}
              />
            </Col>
          </Stack>
        </Stack>
      </Toast.Body>
    </Toast>
  )
}
