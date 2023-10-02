// Import core components
import { useLoaderData, useRouteError } from 'react-router-dom'

// Import our components
import { P404 } from 'pages'
import { Page } from 'components/pages/source'

// Import style
// ...

export function loader({ params }) {
  return Promise.all([import(`studios/${params.code}/sources/${params.source}`), import(`studios/${params.code}/db`).catch(() => {})]).then((files) => files)
}

export function ErrorBoundary() {
  const error = useRouteError()
  return <P404 error={error} />
}

export function Component() {
  // Hooks
  const data = useLoaderData()
  // Variables
  const [source, db] = data
  const { default: Source } = source

  return (
    <Page redux={db}>
      <Source />
    </Page>
  )
}

export default {
  loader,
  ErrorBoundary,
  Component,
}

Component.displayName = 'Source'
ErrorBoundary.displayName = 'SourceErrorBoundary'
