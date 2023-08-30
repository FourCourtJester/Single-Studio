// Import core components
import { useEffect } from 'react'

// Import our components

export const usePageTitle = (title) => {
  useEffect(() => {
    document.title = `${title} - Single Studio`
  }, [title])

  return null
}
