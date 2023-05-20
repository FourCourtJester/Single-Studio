// Import core components
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Form, InputGroup } from 'react-bootstrap'

// Import our components
import { Button } from 'components/global/styled'

// Import style
// ...

function Gate() {
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
    <Container className="d-flex flex-column justify-content-center text-center h-100" fluid>
      <Form ref={$form} noValidate validated={validated}>
        <fieldset className="d-flex flex-column align-items-center ">
          <h4 className="mb-3">Enter your studio code</h4>
          <InputGroup hasValidation className="w-50">
            <Form.Control ref={$code} className="w-50" name="code" placeholder="Demo" required />
            <Button type="submit" name="studio" onClick={handleSubmit}>
              Go
            </Button>
            <Form.Control.Feedback type="invalid">Please enter a Code</Form.Control.Feedback>
          </InputGroup>
        </fieldset>
      </Form>
    </Container>
  )
}

// Exported Component for use
export default Gate
