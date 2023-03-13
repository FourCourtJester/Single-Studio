// Import core components
import { useRef, useState } from 'react'
import { Button, Container, Form, InputGroup } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'

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
  const $code = useRef(null)

  const handleSubmit = (e) => {
    const form = e.currentTarget

    if (form.checkValidity() === false) {
      e.preventDefault()
      e.stopPropagation()
    } else {
      navigate(`/studio/${$code.current.value}`)
    }

    setValidated(true)
  }

  return (
    <Container className="d-flex flex-column justify-content-center text-center h-100" fluid>
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <fieldset className="d-flex flex-column align-items-center ">
          <h4 className="mb-2">Enter your studio code</h4>
          <InputGroup hasValidation className="w-50">
            <Form.Control ref={$code} className="w-50" name="code" placeholder="Demo" required />
            <Button type="submit">Go</Button>
            <Form.Control.Feedback type="invalid">Please enter a Code</Form.Control.Feedback>
          </InputGroup>
        </fieldset>
      </Form>
    </Container>
  )
}

// Exported Component for use
export default Gate
