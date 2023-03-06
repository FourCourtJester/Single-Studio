// Import core components
import { useSearchParams } from 'react-router-dom'

// Import our components
import { Timer } from 'components/source'

// Import style
// ...

function TimerType() {
  // Hooks
  const [query] = useSearchParams()

  // Avoid undefined names
  if (!query.get('name')) return null

  return <Timer name={query.get('name')} />
}

// Exported Component for use
export default TimerType
