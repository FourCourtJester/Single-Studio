// Import core components
import { useSearchParams } from 'react-router-dom'

// Import our components
import { Timer } from 'components/source'

// Import style
// ...

export const ITimer = () => {
  // Hooks
  const [query] = useSearchParams()

  // Avoid undefined names
  if (!query.get('name')) return null

  return <Timer name={query.get('name')} />
}
