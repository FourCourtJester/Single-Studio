// Import core components
import { useRef, useState } from 'react'
import { Button, Container, Form, InputGroup } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'

// Import our components
// ...

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

  const handleSubmit = (e, interactive = false) => {
    const form = $form.current

    e.preventDefault()
    e.stopPropagation()

    if (!form.checkValidity()) {
      setValidated(true)
      return false
    }

    navigate(interactive ? `/studio/${$code.current.value}/i` : `/studio/${$code.current.value}`)
    setValidated(false)

    return false
  }

  return (
    <Container className="d-flex flex-column justify-content-center text-center h-100" fluid>
      <Form ref={$form} noValidate validated={validated}>
        <fieldset className="d-flex flex-column align-items-center ">
          <h4 className="mb-2">Enter your studio code</h4>
          <InputGroup hasValidation className="w-50">
            <Form.Control ref={$code} className="w-50" name="code" placeholder="Demo" required />
            <Button type="submit" name="studio" onClick={handleSubmit}>
              Go
            </Button>
            <Button type="submit" name="interactive" variant="success" onClick={(e) => handleSubmit(e, true)}>
              Interactive
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
