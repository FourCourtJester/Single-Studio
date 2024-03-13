// Import core components
import { useRef, useState } from 'react'
import { Accordion, Col, FloatingLabel, Form, Row, Stack } from 'react-bootstrap'

// Import our components
import { ToolTip } from 'components/global'
import { Button } from 'components/global/styled'

// Import style
// ...

function GateFormSettings() {
  // States
  const [validated, setValidated] = useState(false)
  // Variables
  const settings = {}
  // Refs
  const $form = useRef(null)

  const handleSubmit = (e) => {
    const form = $form.current

    e.preventDefault()

    if (!form.checkValidity()) {
      setValidated(true)
      return false
    }

    // const data = [...new URLSearchParams(new FormData($form.current))]
    // const obj = data.reduce((_obj, [key, val]) => ({ ..._obj, [`obs.${key}`]: val }), {})

    setValidated(false)

    return false
  }

  return (
    <Accordion className="mt-5">
      <Accordion.Item eventKey="0">
        <Accordion.Header>
          <i className="fas fa-cog me-2" />
          OBS Studio
          {/* <Badge className="ms-2" bg="danger">
            <i className="fas fa-check me-2" />
            Not Connected
          </Badge> */}
        </Accordion.Header>
        <Accordion.Body className="p-2">
          <Form ref={$form} noValidate validated={validated} autoComplete="off">
            <fieldset>
              <Stack gap={2} direction="horizontal">
                <Col>
                  <FloatingLabel label="Host">
                    <Form.Control name="host" type="text" placeholder="Host" defaultValue={settings.obs?.host} />
                  </FloatingLabel>
                </Col>
                <Col xs="auto">
                  <FloatingLabel label="Port">
                    <Form.Control name="port" type="number" placeholder="Port" defaultValue={settings.obs?.port} />
                  </FloatingLabel>
                </Col>
                <Col>
                  <FloatingLabel label="Password">
                    <Form.Control name="password" type="password" placeholder="Password" />
                  </FloatingLabel>
                </Col>
              </Stack>
              <Row className="justify-content-end mt-2">
                <Col xs="auto">
                  <ToolTip placement="left" tooltip={<>Save &amp; Connect</>}>
                    <Button variant="obs" type="submit" onClick={handleSubmit}>
                      <i className="fas fa-floppy-disk" />
                    </Button>
                  </ToolTip>
                </Col>
              </Row>
            </fieldset>
          </Form>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  )
}

export default GateFormSettings
