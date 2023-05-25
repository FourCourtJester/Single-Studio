// Import core components
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, InputGroup } from 'react-bootstrap'

// Import our components
import { ToolTip } from 'components/global'
import { Button, GateForm } from 'components/global/styled'

// Import style
// ...

function GateFormNavigate() {
  // Hooks
  const navigate = useNavigate()
  // States
  const [validated, setValidated] = useState(false)
  // Refs
  const $form = useRef(null)
  const $code = useRef(null)

  const handleSubmit = (e) => {
    const form = $form.current

    e.preventDefault()
    e.stopPropagation()

    if (!form.checkValidity()) {
      setValidated(true)
      return false
    }

    navigate(`/studio/${$code.current.value}`)
    setValidated(false)

    return false
  }

  return (
    <GateForm ref={$form} noValidate validated={validated} autoComplete="off">
      <fieldset className="d-flex flex-column align-items-center ">
        <h4 className="mb-3">Enter your studio code</h4>
        <InputGroup className="position-relative" hasValidation>
          <Form.Control ref={$code} className="w-50" name="code" placeholder="Demo" required />
          <Form.Control.Feedback className="position-absolute top-100 start-50 translate-middle mt-3" type="invalid">
            Please enter a Code
          </Form.Control.Feedback>
          <Button name="studio" type="submit" onClick={handleSubmit}>
            <i className="fas fa-play" />
          </Button>
          <ToolTip position="top" tooltip={<>Please enter a Code</>}>
            <Button className="btn-danger" name="studio">
              <i className="fas fa-close" />
            </Button>
          </ToolTip>
        </InputGroup>
      </fieldset>
    </GateForm>
  )
}

export default GateFormNavigate
