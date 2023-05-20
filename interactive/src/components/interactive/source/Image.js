// Import core components
import { useSearchParams } from 'react-router-dom'

// Import our components
import { Image } from 'components/source'

// Import style
// ...

export const IImage = () => {
  // Hooks
  const [query] = useSearchParams()

  // Avoid undefined names
  if (!query.get('name')) return null

  return <Image className="mw-100 mh-100" name={query.get('name')} />
}
