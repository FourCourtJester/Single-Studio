// Import core components
import { useLoaderData, useRouteError } from 'react-router-dom'
import { Container } from 'react-bootstrap'

// Import our components
import { P404 } from 'pages'

// Import style
// ...

export function loader({ params }) {
  return import(`studios/${params.code}/sources/${params.source}`)
}

export function ErrorBoundary() {
  const error = useRouteError()
  return <P404 error={error} />
}

export function Component() {
  // Hooks
  const { default: Source } = useLoaderData()

  return (
    <Container id="source" className="p-0" fluid>
      <Source />
    </Container>
  )
}

export default {
  loader,
  ErrorBoundary,
  Component,
}

Component.displayName = 'Source'
ErrorBoundary.displayName = 'SourceErrorBoundary'
