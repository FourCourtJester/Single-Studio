// Import core components
import { useLoaderData, useRouteError } from 'react-router-dom'

// Import our components
import { P404 } from 'pages'
import { Page } from 'components/pages/studio'

// Import style
// ...

export function loader({ params }) {
  return Promise.all([import(`studios/${params.code}/Studio`), import(`studios/${params.code}/db`).catch(() => {})]).then((files) => files)
}

export function ErrorBoundary() {
  const error = useRouteError()
  return <P404 error={error} />
}

export function Component() {
  // Hooks
  const data = useLoaderData()
  // Variables
  const [studio, db] = data
  const { name, Studio } = studio

  return (
    <Page name={name} redux={db}>
      <Studio />
    </Page>
  )
}

export default {
  loader,
  ErrorBoundary,
  Component,
}

Component.displayName = 'Studio'
ErrorBoundary.displayName = 'StudioErrorBoundary'
