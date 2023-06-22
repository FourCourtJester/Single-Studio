// Import core components
import { Container } from 'react-bootstrap'

// Import our components
import { Navigate } from 'components/gate'

// Import style
// ...

function Gate() {
  return (
    <Container className="d-flex flex-column justify-content-center text-center h-100">
      <Navigate />
    </Container>
  )
}

// Exported Component for use
export default Gate
