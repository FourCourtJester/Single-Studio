// Import core components
import { useLoaderData, useRouteError } from 'react-router-dom'
import { Container } from 'react-bootstrap'

// Import our components
import { P404 } from 'pages'
import * as Utils from 'toolkits/utils'

// Import style
// ...

export function loader({ params }) {
  return import(`components/interactive/source/${Utils.capitalize(params.type)}`)
}

export function ErrorBoundary() {
  const error = useRouteError()

  return <P404 error={error} />
}

export function Component() {
  // Hooks
  const { default: Source } = useLoaderData()

  return (
    <Container id="source" className="interactive p-0 w-100 h-100" fluid>
      <Source />
    </Container>
  )
}

export default {
  loader,
  ErrorBoundary,
  Component,
}

Component.displayName = 'InteractiveSource'
ErrorBoundary.displayName = 'InteractiveSourceErrorBoundary'
