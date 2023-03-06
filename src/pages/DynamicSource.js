// Import core components
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Container } from 'react-bootstrap'

// Import our components
import * as Utils from 'toolkits/utils'

// Import style
// ...

function DynamicSource() {
  // Hooks
  const params = useParams()
  // States
  const [Type, setType] = useState(false)

  useEffect(() => {
    Promise.resolve(true)
      .then(() => import(`studios/${params.code}/scss/sources.scss`))
      .then(() => import(`components/interactive/source/${Utils.capitalize(params.type)}`))
      .then((s) => setType({ Page: s.default }))
      .catch((err) => {
        console.error(err)
      })

    return () => setType(false)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  if (Type === false) return null

  return (
    <Container id="source" className="interactive p-0 w-100 h-100" fluid>
      <Type.Page />
    </Container>
  )
}

// Exported Component for use
export default DynamicSource
