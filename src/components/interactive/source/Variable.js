// Import core components
import { useSearchParams } from 'react-router-dom'

// Import our components
import { Variable } from 'components/source'

// Import style
// ...

export const IVariable = () => {
  // Hooks
  const [query] = useSearchParams()

  // Avoid undefined names
  if (!query.get('name')) return null

  return <Variable name={query.get('name')} />
}
