// Import core components
import { useState } from 'react'
import { useLoaderData, useParams, useRouteError } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { useEffectOnce } from 'hooks'
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
  const params = useParams()
  // States
  const [theme, setTheme] = useState(false)
  // Variables
  const { key, mod } = params

  useEffectOnce(() => {
    if (mod === 'theme') setTheme(key)
  })

  return (
    <Container id="source" className={cN(theme ? `theme-${theme}` : false, 'p-0')} fluid>
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
