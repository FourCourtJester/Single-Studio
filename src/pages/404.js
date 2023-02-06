// Import React and Components
import { Link } from 'react-router-dom'

// Import Styling
import { Container } from 'react-bootstrap'

// Import our Components
// ...

/**
 * Page: 404
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
function P404() {
  return (
    <Container className="d-flex flex-column justify-content-center text-center h-100" fluid>
      <main>
        <h4>404</h4>
        <p>
          Would you like to <Link to="/">try again</Link>?
        </p>
      </main>
    </Container>
  )
}

export default P404
