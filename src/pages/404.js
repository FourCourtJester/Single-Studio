// Import React and Components
import { isRouteErrorResponse, Link } from 'react-router-dom'

// Import Styling
import { Container } from 'react-bootstrap'

// Import our Components
// ...

function P404(properties) {
  const { error } = properties

  return (
    <Container className="d-flex flex-column justify-content-center text-center h-100" fluid>
      <main>
        {isRouteErrorResponse(error) ? (
          <>
            <h4>{error.status}</h4>
            <p>{error.statusText}</p>
          </>
        ) : (
          <>
            <h4>404</h4>
            <p>
              Would you like to <Link to="/">try again</Link>?
            </p>
          </>
        )}
      </main>
    </Container>
  )
}

export default P404
