// Import core components
import { useParams } from 'react-router-dom'

// Import our components
import { Variable } from 'components/source'

// Import style
// ...

export const Source = () => {
  // Hooks
  const params = useParams()

  return <Variable name={params.source} />
}
