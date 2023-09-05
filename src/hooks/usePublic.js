// Import core components
import { useParams } from 'react-router-dom'

// Import our components

export const usePublic = () => {
  // Hooks
  const params = useParams()
  // Variables
  const publik = `${process.env.PUBLIC_URL}/${params.code}`

  return publik
}
