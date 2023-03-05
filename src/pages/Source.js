// Import core components
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Container } from 'react-bootstrap'

// Import our components
// ...

// Import style
// ...

function Source() {
  // Hooks
  const params = useParams()
  // States
  const [SSource, setSource] = useState(false)

  useEffect(() => {
    Promise.resolve(true)
      .then(() => import(`projects/${params.code}/sources/${params.source}`))
      .then((s) => setSource({ Page: s.default }))
      .catch((err) => {
        console.error(err)
      })

    return () => setSource(false)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (SSource === false) return null

  return (
    <Container id="source" className="p-0" fluid>
      <SSource.Page />
    </Container>
  )
}

export default Source
