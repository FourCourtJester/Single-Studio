// Import core components
import { useParams } from 'react-router-dom'

// Import our components

export const usePublic = () => {
  // Hooks
  const params = useParams()
  // Variables
  const publik = `./${params.code}`

  return publik
}
