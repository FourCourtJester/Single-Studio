// Import React and Components
import { useEffect, useState } from 'react'
import { isRouteErrorResponse, Link } from 'react-router-dom'
import { Container, ToastContainer, Toast } from 'react-bootstrap'

// Import Styling
// ...

// Import our Components
// ...

function P404(properties) {
  // Properties
  const { error } = properties
  // States
  const [e, setError] = useState(false)

  useEffect(() => {
    if (error) {
      console.warn(error)
      if (error.message) setError(error)
      if (isRouteErrorResponse(error)) setError({ ...error, route: true })
    }
  }, [error])

  return (
    <>
      <Container className="d-flex flex-column justify-content-center text-center h-100" fluid>
        <main>
          <h4>404</h4>
          <p>
            Would you like to <Link to="/">try again</Link>?
          </p>
        </main>
      </Container>
      {error && (
        <ToastContainer className="m-4" position="bottom-end">
          <Toast bg="danger">
            <Toast.Header>
              <span className="me-auto">Error</span>
            </Toast.Header>
            <Toast.Body>
              {e.route ? (
                <>
                  {e.status} - {e.statusText}
                </>
              ) : (
                e.message
              )}
            </Toast.Body>
          </Toast>
        </ToastContainer>
      )}
    </>
  )
}

export default P404
