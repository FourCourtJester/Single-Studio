// Import core components
import { useParams } from 'react-router-dom'

// Import our components

export const usePublic = (code = true) => {
  // Hooks
  const params = useParams()

  return code ? `${process.env.PUBLIC_URL}/${params.code}` : process.env.PUBLIC_URL
}
