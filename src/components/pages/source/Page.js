// Import core components
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { useEffectOnce, useRedux } from 'hooks'

// Import style
// ...

export function Page(properties) {
  // Properties
  const { children, redux } = properties
  // Hooks
  const params = useParams()
  // States
  const [theme, setTheme] = useState(false)
  // Variables
  const { key, mod } = params

  useEffectOnce(() => {
    if (mod === 'theme') setTheme(key)
  })

  useRedux(redux)

  return (
    <Container id="source" className={cN(theme ? `theme-${theme}` : false, 'p-0')} fluid>
      {children}
    </Container>
  )
}
