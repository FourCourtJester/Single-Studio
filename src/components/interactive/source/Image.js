// Import core components
import { useSearchParams } from 'react-router-dom'

// Import our components
import { Image } from 'components/source'

// Import style
// ...

function ImageType() {
  // Hooks
  const [query] = useSearchParams()

  // Avoid undefined names
  if (!query.get('name')) return null

  return <Image className="mw-100 mh-100" name={query.get('name')} />
}

// Exported Component for use
export default ImageType
