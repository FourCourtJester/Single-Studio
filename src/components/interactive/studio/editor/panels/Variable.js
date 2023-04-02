// Import core components
import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import { Button, Col, Dropdown as BSDropdown, Form, Stack, Toast } from 'react-bootstrap'

// Import our components
import { Dropdown } from 'components/global/styled'
import { selectComponent, updateInteractiveComponent, updateInteractiveSelected } from 'db/slices/interactive'
import { ToolTip } from 'components/global'

// Import style
// ...

export const VariablePanel = (properties) => {
  // Properties
  const { id } = properties
  // Hooks
  const params = useParams()
  const dispatch = useDispatch()
  // Redux
  const component = useSelector((state) => selectComponent(state, id))
  // States
  const [show, setShow] = useState(true)
  const url = `?layer-name=${component.label} | SS Var | ${id}&layer-width=960&layer-height=64#/studio/${params.code}/i/variable/${id}`

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

  return (
    <Toast show={show} onClose={handleClose}>
      <Toast.Header className="py-2 px-3">
        <Form.Control
          className="bg-transparent border-0 text-dark rounded-0 py-0"
          size="sm"
          placeholder={`Variable ${id}`}
          value={component.label || ''}
          onChange={(e) => handleChange(e, 'label')}
        />
        <ToolTip placement="top" tooltip={<>Export to OBS</>}>
          <Button size="sm" variant="link" type="button" href={url} target={id}>
            <i className="fas fa-up-right-from-square" />
          </Button>
        </ToolTip>
      </Toast.Header>
      <Toast.Body className="p-3">
        <Stack gap={2}>
          <Stack className="justify-content-center" direction="horizontal" gap={2}>
            <Col xs="auto">
              <ToolTip position="top" tooltip={<>Font Family</>}>
                <Button size="sm" variant="light" type="button">
                  <i className="fas fa-font" />
                </Button>
              </ToolTip>
            </Col>
            <Col xs="auto">
              <ToolTip position="top" tooltip={<>Font Size</>}>
                <Button size="sm" variant="light" type="button">
                  <i className="fas fa-text-height" />
                </Button>
              </ToolTip>
            </Col>
            <Col xs="auto">
              <ToolTip position="top" tooltip={<>Font Color</>}>
                <Button size="sm" variant="light" type="button">
                  <i className="fas fa-square" />
                </Button>
              </ToolTip>
            </Col>
            <span className="text-dark">|</span>
            <Col xs="auto">
              <ToolTip position="top" tooltip={<>Bold</>}>
                <Button size="sm" variant="light" type="button">
                  <i className="fas fa-bold" />
                </Button>
              </ToolTip>
            </Col>
            <Col xs="auto">
              <ToolTip position="top" tooltip={<>Italics</>}>
                <Button size="sm" variant="light" type="button">
                  <i className="fas fa-italic" />
                </Button>
              </ToolTip>
            </Col>
            <Col xs="auto">
              <ToolTip position="top" tooltip={<>Underline</>}>
                <Button size="sm" variant="light" type="button">
                  <i className="fas fa-underline" />
                </Button>
              </ToolTip>
            </Col>
            <Col xs="auto">
              <Dropdown size="sm" variant="light" title={<i className="fas fa-align-left" />}>
                <ToolTip placement="left" tooltip={<>Align Left</>}>
                  <BSDropdown.Item>
                    <i className="fas fa-align-left" />
                  </BSDropdown.Item>
                </ToolTip>
                <ToolTip placement="left" tooltip={<>Align Center</>}>
                  <BSDropdown.Item>
                    <i className="fas fa-align-center" />
                  </BSDropdown.Item>
                </ToolTip>
                <ToolTip placement="left" tooltip={<>Align Right</>}>
                  <BSDropdown.Item>
                    <i className="fas fa-align-right" />
                  </BSDropdown.Item>
                </ToolTip>
              </Dropdown>
            </Col>
          </Stack>
        </Stack>
      </Toast.Body>
    </Toast>
  )
}
