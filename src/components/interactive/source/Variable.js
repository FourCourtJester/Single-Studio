// Import core components
import { useSearchParams } from 'react-router-dom'

// Import our components
import { Variable } from 'components/source'

// Import style
// import '../scss/sources.scss'

function VariableType() {
  // Hooks
  const [query] = useSearchParams()

  // Avoid undefined names
  if (!query.get('name')) return null

  return <Variable name={query.get('name')} />
}

// Exported Component for use
export default VariableType
